// Pure date/task helpers. "Due" = actual deadline; "planned" = day the student intends to work on it.
import { addDays, format, isBefore, startOfDay, startOfWeek } from "date-fns";

export type TaskLike = {
  status: string;
  due_at: string | null;
  planned_date: string | null;
  estimated_minutes?: number | null;
  task_type?: string;
};

export const isDone = (t: TaskLike) => t.status === "done";

/** Planned dates are calendar days (no time). Parse as local date. */
export function parsePlanned(d: string | null): Date | null {
  if (!d) return null;
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export const toDateKey = (d: Date) => format(d, "yyyy-MM-dd");

export function isOverdue(t: TaskLike, now = new Date()) {
  return !isDone(t) && !!t.due_at && isBefore(new Date(t.due_at), now);
}

/** A task belongs to "today" if planned for today, or due today without a different plan. */
export function isForToday(t: TaskLike, now = new Date()) {
  if (isDone(t)) return false;
  const key = toDateKey(now);
  if (t.planned_date) return t.planned_date <= key && !isOverdue(t, now);
  return !!t.due_at && toDateKey(new Date(t.due_at)) === key && !isOverdue(t, now);
}

export function isUpcoming(t: TaskLike, days = 7, now = new Date()) {
  if (isDone(t) || !t.due_at) return false;
  const due = new Date(t.due_at);
  return !isBefore(due, now) && isBefore(due, addDays(startOfDay(now), days + 1));
}

/** The day a task is scheduled on a calendar/workload: planned date wins, otherwise due date. */
export function workDay(t: TaskLike): Date | null {
  return parsePlanned(t.planned_date) ?? (t.due_at ? startOfDay(new Date(t.due_at)) : null);
}

/** Minutes of open work per day for the week containing `now`. */
export function weeklyWorkload(tasks: TaskLike[], now = new Date(), weekStartsOn: 0 | 1 = 1, fallbackMinutes = 60) {
  const start = startOfWeek(now, { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const key = toDateKey(day);
    const minutes = tasks
      .filter((t) => !isDone(t))
      .filter((t) => {
        const w = workDay(t);
        return w && toDateKey(w) === key;
      })
      .reduce((sum, t) => sum + (t.estimated_minutes ?? fallbackMinutes), 0);
    return { day, key, minutes };
  });
}

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const STATUSES = ["todo", "in_progress", "done"] as const;
export const STATUS_LABEL: Record<string, string> = { todo: "To do", in_progress: "In progress", done: "Done" };
export const TASK_TYPES = ["assignment", "homework", "exam", "quiz", "lab", "reading", "essay", "project", "study", "other"] as const;
export const RECURRENCES = ["none", "daily", "weekly", "biweekly", "monthly"] as const;

/** Next due/planned dates when a recurring task is completed. */
export function nextOccurrence(recurrence: string, date: Date): Date | null {
  switch (recurrence) {
    case "daily": return addDays(date, 1);
    case "weekly": return addDays(date, 7);
    case "biweekly": return addDays(date, 14);
    case "monthly": { const d = new Date(date); d.setMonth(d.getMonth() + 1); return d; }
    default: return null;
  }
}
