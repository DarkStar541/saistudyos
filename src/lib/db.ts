import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { nextOccurrence, parsePlanned, toDateKey } from "./task-utils";

type T = Database["public"]["Tables"];
export type Profile = T["profiles"]["Row"];
export type Course = T["courses"]["Row"];
export type Project = T["projects"]["Row"];
export type Milestone = T["milestones"]["Row"];
export type Task = T["tasks"]["Row"];
export type Subtask = T["subtasks"]["Row"];
export type TaskInsert = T["tasks"]["Insert"];

const unwrap = <D,>(r: { data: D | null; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data as D;
};

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    return unwrap(await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle()) as Profile | null;
  },
});
export const coursesQuery = queryOptions({
  queryKey: ["courses"],
  queryFn: async () => unwrap(await supabase.from("courses").select("*").order("name")) as Course[],
});
export const projectsQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: async () => unwrap(await supabase.from("projects").select("*").order("created_at", { ascending: false })) as Project[],
});
export const milestonesQuery = queryOptions({
  queryKey: ["milestones"],
  queryFn: async () => unwrap(await supabase.from("milestones").select("*").order("position")) as Milestone[],
});
export const tasksQuery = queryOptions({
  queryKey: ["tasks"],
  queryFn: async () => unwrap(await supabase.from("tasks").select("*").order("due_at", { ascending: true, nullsFirst: false })) as Task[],
});
export const subtasksQuery = queryOptions({
  queryKey: ["subtasks"],
  queryFn: async () => unwrap(await supabase.from("subtasks").select("*").order("position")) as Subtask[],
});

export const useProfile = () => useQuery(profileQuery);
export const useCourses = () => useQuery(coursesQuery);
export const useProjects = () => useQuery(projectsQuery);
export const useMilestones = () => useQuery(milestonesQuery);
export const useTasks = () => useQuery(tasksQuery);
export const useSubtasks = () => useQuery(subtasksQuery);

type TableName = "courses" | "projects" | "milestones" | "tasks" | "subtasks" | "profiles";

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

/** Toggle completion; completing a recurring task spawns the next occurrence. */
export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Task) => {
      const done = t.status !== "done";
      unwrap(await supabase.from("tasks").update({ status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null }).eq("id", t.id));
      if (done && t.recurrence !== "none") {
        const nextDue = t.due_at ? nextOccurrence(t.recurrence, new Date(t.due_at)) : null;
        const p = parsePlanned(t.planned_date);
        const nextPlan = p ? nextOccurrence(t.recurrence, p) : null;
        const { id: _i, created_at: _c, updated_at: _u, completed_at: _d, ...rest } = t;
        unwrap(await supabase.from("tasks").insert({ ...rest, status: "todo", due_at: nextDue?.toISOString() ?? null, planned_date: nextPlan ? toDateKey(nextPlan) : null }));
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export const COURSE_COLORS = ["purple", "blue", "green", "coral", "orange", "pink", "teal", "slate"] as const;
export const colorVar = (c: string | null | undefined) => `var(--course-${COURSE_COLORS.includes(c as never) ? c : "purple"})`;
