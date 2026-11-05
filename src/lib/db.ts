import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { nextPendingOccurrence, type RecurrenceRule } from "./recurrence";
import { parsePlanned, toDateKey } from "./task-utils";

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
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    return unwrap(await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle()) as Profile | null;
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

/** Generic upsert/delete mutation for a user-owned table. RLS enforces ownership server-side. */
export function useSave(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { id, ...rest } = row;
      if (id) return unwrap(await supabase.from(table).update(rest as never).eq("id", id as string).select().single());
      return unwrap(await supabase.from(table).insert(rest as never).select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table === "profiles" ? "profile" : table] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
export function useRemove(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from(table).delete().eq("id", id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** The series root id for a recurring task (the task itself when it is the root). */
export const seriesIdOf = (t: Task) => t.recurrence_parent_id ?? t.id;

const ruleOf = (t: Task): RecurrenceRule => ({
  recurrence: t.recurrence,
  recurrence_interval: t.recurrence_interval,
  recurrence_days: t.recurrence_days,
  recurrence_end: t.recurrence_end,
});

/**
 * Compute the next occurrence of a recurring task. Returns null when the rule
 * has ended. Missed slots are skipped so the next instance lands today or later.
 */
export function nextInstancePatch(t: Task, now = new Date()): { due_at: string | null; planned_date: string | null } | null {
  const rule = ruleOf(t);
  const anchor = parsePlanned(t.planned_date) ?? (t.due_at ? new Date(t.due_at) : null);
  if (!anchor) return null;
  const next = nextPendingOccurrence(rule, anchor, now);
  if (!next) return null;
  return {
    due_at: t.due_at ? (() => { const d = new Date(next); const old = new Date(t.due_at); d.setHours(old.getHours(), old.getMinutes(), 0, 0); return d.toISOString(); })() : null,
    planned_date: t.planned_date ? toDateKey(next) : null,
  };
}

/** Toggle completion; completing a recurring task spawns the next occurrence (deduplicated). */
export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Task) => {
      const done = t.status !== "done";
      unwrap(await supabase.from("tasks").update({ status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null }).eq("id", t.id));
      if (done && t.recurrence !== "none") {
        const patch = nextInstancePatch(t);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Skip the current occurrence of a recurring task: advance it to the next slot without completing it. */
export function useSkipOccurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Task) => {
      const patch = nextInstancePatch(t);
      if (!patch) throw new Error("This series has ended — no future occurrences.");
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
