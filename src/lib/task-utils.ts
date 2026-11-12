// Pure date/task helpers. "Due" = actual deadline; "planned" = day the student intends to work on it.
import { addDays, format, isBefore, isSameDay, startOfDay, startOfWeek } from "date-fns";

export type TaskLike = {
  status: string;
  due_at: string | null;
  planned_date: string | null;
  estimated_minutes?: number | null;
  task_type?: string;
  id?: string;
  recurrence_parent_id?: string | null;
  completed_at?: string | null;
};

export const isDone = (t: TaskLike) => t.status === "done";

/** Planned dates are calendar days (no time). Parse as local date. */
export function parsePlanned(d: string | null): Date | null {
  if (!d) return null;
  const [y = 1970, m = 1, day = 1] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export const toDateKey = (d: Date) => format(d, "yyyy-MM-dd");
/** Convert an ISO instant into date/time input values in the saved IANA time zone. */
export function dateTimeInputInTimeZone(iso: string, timeZone?: string | null) {
  const date = new Date(iso);
  if (!timeZone) return { date: format(date, "yyyy-MM-dd"), time: format(date, "HH:mm") };
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date);
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
  } catch {
    return { date: format(date, "yyyy-MM-dd"), time: format(date, "HH:mm") };
  }
}

/** Interpret a date/time input as wall-clock time in the saved IANA time zone. */
export function dateTimeInTimeZoneToIso(dateKey: string, time: string, timeZone?: string | null): string {
  if (!timeZone) return new Date(`${dateKey}T${time || "23:59"}`).toISOString();
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = (time || "23:59").split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = target;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      const parts = formatter.formatToParts(new Date(candidate));
      const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
      const represented = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
      const delta = represented - target;
      if (delta === 0) break;
      candidate -= delta;
    }
  } catch {
    candidate = new Date(`${dateKey}T${time || "23:59"}`).getTime();
  }
  return new Date(candidate).toISOString();
}


/** Format an instant as a calendar date in the student's saved IANA time zone. */
export function dateKeyInTimeZone(date: Date, timeZone?: string | null): string {
  if (!timeZone) return toDateKey(date);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    // A stale/invalid saved zone must not break the calendar.
    return toDateKey(date);
  }
}

/** Independent calendar channels: a deadline is never a work-session banner. */
export function calendarDays<T extends TaskLike>(tasks: T[], timeZone?: string | null) {
  const days = new Map<string, { work: T[]; deadlines: T[]; dueCount: number }>();
  const day = (key: string) => {
    let entry = days.get(key);
    if (!entry) {
      entry = { work: [], deadlines: [], dueCount: 0 };
      days.set(key, entry);
    }
    return entry;
  };
  // A recurring series shares one deadline: show it once per series, preferring the open instance.
  const seen = new Map<string, T>();
  for (const task of tasks) {
    if (task.planned_date) day(task.planned_date).work.push(task);
    if (task.due_at) {
      const dayKey = dateKeyInTimeZone(new Date(task.due_at), timeZone);
      const entry = day(dayKey);
      const sid = task.recurrence_parent_id ?? task.id;
      const seriesKey = sid ? `${sid}|${task.due_at}` : null;
      const prior = seriesKey ? seen.get(seriesKey) : undefined;
      if (prior) {
        if (isDone(prior) && !isDone(task)) {
          entry.deadlines[entry.deadlines.indexOf(prior)] = task;
          entry.dueCount++;
          seen.set(seriesKey!, task);
        }
        continue;
      }
      if (seriesKey) seen.set(seriesKey, task);
      entry.deadlines.push(task);
      if (!isDone(task)) entry.dueCount++;
    }
  }
  return days;
}

export function isOverdue(t: TaskLike, now = new Date()) {
  return !isDone(t) && !!t.due_at && isBefore(new Date(t.due_at), now);
}

/** A task belongs to today if planned for today, or due today without a different plan. */
export function isForToday(t: TaskLike, now = new Date(), timeZone?: string | null) {
  if (isDone(t)) return false;
  const key = dateKeyInTimeZone(now, timeZone);
  if (t.planned_date) return t.planned_date <= key && !isOverdue(t, now);
  return !!t.due_at && dateKeyInTimeZone(new Date(t.due_at), timeZone) === key && !isOverdue(t, now);
}

/** Shared progress model for dashboard gauges: completed work counts only when it was scheduled for today and completed today. */
export function todayProgress(tasks: TaskLike[], now = new Date(), timeZone?: string | null) {
  const todayKey = dateKeyInTimeZone(now, timeZone);
  const completed = tasks.filter((task) => {
    const scheduledToday = task.planned_date === todayKey || (!task.planned_date && !!task.due_at && dateKeyInTimeZone(new Date(task.due_at), timeZone) === todayKey);
    return scheduledToday && isDone(task) && !!task.completed_at && dateKeyInTimeZone(new Date(task.completed_at), timeZone) === todayKey;
  }).length;
  const remaining = tasks.filter((task) => isForToday(task, now, timeZone)).length;
  const total = completed + remaining;
  return { completed, remaining, total, completionRatio: total ? completed / total : 0, remainingRatio: total ? remaining / total : 0 };
}

export function isUpcoming(t: TaskLike, days = 7, now = new Date(), timeZone?: string | null) {
  if (isDone(t) || !t.due_at) return false;
  const due = new Date(t.due_at);
  const todayKey = dateKeyInTimeZone(now, timeZone);
  const [year, month, day] = todayKey.split("-").map(Number);
  const calendarToday = new Date(year, month - 1, day);
  const endDate = toDateKey(addDays(calendarToday, days + 1));
  const endBoundary = dateTimeInTimeZoneToIso(endDate, "00:00", timeZone);
  return !isBefore(due, now) && isBefore(due, new Date(endBoundary));
}

/** The day a task is scheduled on a calendar/workload: planned date wins, otherwise due date. */
export function workDay(t: TaskLike, timeZone?: string | null): Date | null {
  return parsePlanned(t.planned_date) ?? (t.due_at ? parsePlanned(dateKeyInTimeZone(new Date(t.due_at), timeZone)) : null);
}

/** Minutes of open work per day for the week containing now. */
export function weeklyWorkload(tasks: TaskLike[], now = new Date(), weekStartsOn: 0 | 1 = 1, fallbackMinutes = 60, timeZone?: string | null) {
  const calendarToday = parsePlanned(dateKeyInTimeZone(now, timeZone)) ?? now;
  const start = startOfWeek(calendarToday, { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const key = toDateKey(day);
    const minutes = tasks.filter((t) => !isDone(t)).filter((t) => { const w = workDay(t, timeZone); return w && toDateKey(w) === key; }).reduce((sum, t) => sum + (t.estimated_minutes ?? fallbackMinutes), 0);
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
