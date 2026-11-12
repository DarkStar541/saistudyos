import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { nextInstanceDates } from "./recurrence";

type T = Database["public"]["Tables"];
export type Profile = T["profiles"]["Row"];
export type Course = T["courses"]["Row"];
export type Project = T["projects"]["Row"];
export type Milestone = T["milestones"]["Row"];
export type Task = T["tasks"]["Row"];
export type Subtask = T["subtasks"]["Row"];
export type FocusSession = T["focus_sessions"]["Row"];
export type TaskInsert = T["tasks"]["Insert"];

const unwrap = <D,>(r: { data: D | null; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data as D;
};

// Data changes only through our own mutations, which invalidate these keys —
// so a 60s staleTime safely kills repeat fetches on every navigation.
const STALE = 60_000;

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  staleTime: STALE,
  queryFn: async () => {
    // Local session read — avoids an auth-server round trip before every profile fetch.
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.user) return null;
    return unwrap(await supabase.from("profiles").select("*").eq("id", s.session.user.id).maybeSingle()) as Profile | null;
  },
});
export const coursesQuery = queryOptions({
  queryKey: ["courses"],
  staleTime: STALE,
  queryFn: async () => unwrap(await supabase.from("courses").select("*").order("name")) as Course[],
});
export const projectsQuery = queryOptions({
  queryKey: ["projects"],
  staleTime: STALE,
  queryFn: async () => unwrap(await supabase.from("projects").select("*").order("created_at", { ascending: false })) as Project[],
});
export const milestonesQuery = queryOptions({
  queryKey: ["milestones"],
  staleTime: STALE,
  queryFn: async () => unwrap(await supabase.from("milestones").select("*").order("position")) as Milestone[],
});
export const tasksQuery = queryOptions({
  queryKey: ["tasks"],
  staleTime: STALE,
  queryFn: async () => unwrap(await supabase.from("tasks").select("*").order("due_at", { ascending: true, nullsFirst: false })) as Task[],
});
export const subtasksQuery = queryOptions({
  queryKey: ["subtasks"],
  staleTime: STALE,
  queryFn: async () => unwrap(await supabase.from("subtasks").select("*").order("position")) as Subtask[],
});
export const focusSessionsQuery = queryOptions({
  queryKey: ["focus_sessions"],
  staleTime: STALE,
  queryFn: async () => unwrap(await supabase.from("focus_sessions").select("*").order("started_at", { ascending: false })) as FocusSession[],
});

export const useProfile = () => useQuery(profileQuery);
export const useCourses = () => useQuery(coursesQuery);
export const useProjects = () => useQuery(projectsQuery);
export const useMilestones = () => useQuery(milestonesQuery);
export const useTasks = () => useQuery(tasksQuery);
export const useSubtasks = () => useQuery(subtasksQuery);
export const useFocusSessions = () => useQuery(focusSessionsQuery);

type TableName = "courses" | "projects" | "milestones" | "tasks" | "subtasks" | "profiles" | "focus_sessions";

const keyOf = (table: TableName) => [table === "profiles" ? "profile" : table];

/** Generic upsert/delete mutation for a user-owned table. RLS enforces ownership server-side. */
export function useSave(table: TableName) {
  const qc = useQueryClient();
  const key = keyOf(table);
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { id, ...rest } = row;
      if (id) return unwrap(await supabase.from(table).update(rest as never).eq("id", id as string).select().single());
      return unwrap(await supabase.from(table).insert(rest as never).select().single());
    },
    // Optimistic update for existing rows so edits feel instant; inserts wait for the server id.
    onMutate: async (row) => {
      if (!row["id"]) return undefined;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Record<string, unknown>[]>(key);
      qc.setQueryData<Record<string, unknown>[]>(key, (old) =>
        old?.map((r) => (r["id"] === row["id"] ? { ...r, ...row } : r)),
      );
      return { previous };
    },
    onError: (e: Error, _row, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
export function useRemove(table: TableName) {
  const qc = useQueryClient();
  const key = keyOf(table);
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from(table).delete().eq("id", id)),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Record<string, unknown>[]>(key);
      qc.setQueryData<Record<string, unknown>[]>(key, (old) => old?.filter((r) => r["id"] !== id));
      return { previous };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** The series root id for a recurring task (the task itself when it is the root). */
export const seriesIdOf = (t: Task) => t.recurrence_parent_id ?? t.id;

/**
 * Compute the next occurrence of a recurring task. Returns null when the rule
 * has ended. Missed slots are skipped so the next instance lands today or later.
 */
export function nextInstancePatch(t: Task, now = new Date(), timeZone?: string | null): { due_at: string | null; planned_date: string | null } | null {
  return nextInstanceDates(t, now, timeZone);
}

/** Toggle completion; completing a recurring task spawns the next occurrence (deduplicated). Optimistic: the checkbox flips instantly and rolls back on failure. */
export function useToggleTask() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  return useMutation({
    mutationFn: async (t: Task) => {
      const done = t.status !== "done";
      unwrap(await supabase.from("tasks").update({ status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null }).eq("id", t.id));
      if (done && t.recurrence !== "none") {
        const patch = nextInstancePatch(t, new Date(), profile?.timezone);
        if (!patch) return; // series ended
        const sid = seriesIdOf(t);
        // Prevent duplicates: if an open instance of this series already exists, don't spawn another.
        const existing = unwrap(
          await supabase.from("tasks").select("id").eq("recurrence_parent_id", sid).neq("status", "done").neq("id", t.id).limit(1),
        );
        if (existing.length) return;
        const { id: _i, created_at: _c, updated_at: _u, completed_at: _d, ...rest } = t;
        unwrap(await supabase.from("tasks").insert({ ...rest, status: "todo", ...patch, recurrence_parent_id: sid }));
      }
    },
    onMutate: async (t) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const previous = qc.getQueryData<Task[]>(["tasks"]);
      const done = t.status !== "done";
      qc.setQueryData<Task[]>(["tasks"], (old) =>
        old?.map((r) => (r.id === t.id ? { ...r, status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null } : r)),
      );
      return { previous };
    },
    onError: (e: Error, _t, ctx) => {
      if (ctx?.previous) qc.setQueryData(["tasks"], ctx.previous);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/** Skip the current occurrence of a recurring task: advance it to the next slot without completing it. */
export function useSkipOccurrence() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  return useMutation({
    mutationFn: async (t: Task) => {
      const patch = nextInstancePatch(t, new Date(), profile?.timezone);
      if (!patch) throw new Error("This series has ended — no future occurrences.");
      const sid = seriesIdOf(t);
      const existing = unwrap(
        await supabase.from("tasks").select("id").eq("recurrence_parent_id", sid)
          .eq("planned_date", patch.planned_date).neq("status", "done").neq("id", t.id).limit(1),
      );
      if (existing.length) throw new Error("That next occurrence already exists. Refresh the task list before skipping.");
      unwrap(await supabase.from("tasks").update(patch).eq("id", t.id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Skipped to the next occurrence");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const COURSE_COLORS = ["purple", "blue", "green", "coral", "orange", "pink", "teal", "slate"] as const;
export const colorVar = (c: string | null | undefined) => `var(--course-${COURSE_COLORS.includes(c as never) ? c : "purple"})`;
