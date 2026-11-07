// Recurrence engine for repeating tasks. Pure functions, tested in src/test/recurrence.test.ts.
import { addDays, addMonths, addYears, differenceInCalendarDays, startOfDay } from "date-fns";
import { parsePlanned, toDateKey, type TaskLike } from "./task-utils";

export type RecurrenceRule = {
  recurrence: string;
  recurrence_interval?: number | null;
  recurrence_days?: number[] | null; // 0 = Sunday … 6 = Saturday
  recurrence_end?: string | null; // yyyy-MM-dd, null = no end
};

export const RECURRENCE_OPTIONS = [
  { id: "none", label: "Never" },
  { id: "daily", label: "Daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "custom", label: "Custom" },
] as const;

export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const intervalOf = (r: RecurrenceRule) => Math.max(1, Math.min(365, r.recurrence_interval ?? 1));

/** The next occurrence strictly after `from`, or null when the rule ends first. */
export function nextOccurrenceDate(rule: RecurrenceRule, from: Date): Date | null {
  const n = intervalOf(rule);
  let next: Date | null = null;
  switch (rule.recurrence) {
    case "daily":
      next = addDays(from, n);
      break;
    case "weekdays": {
      let d = addDays(from, 1);
      while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
      next = d;
      break;
    }
    case "weekly": {
      const days = (rule.recurrence_days ?? []).filter((d) => d >= 0 && d <= 6);
      if (days.length) {
        let d = addDays(from, 1);
        for (let i = 0; i < 7 * n + 7 && !days.includes(d.getDay()); i++) d = addDays(d, 1);
        next = d;
      } else {
        next = addDays(from, 7 * n);
      }
      break;
    }
    case "biweekly":
      next = addDays(from, 14);
      break;
    case "monthly":
      next = addMonths(from, n);
      break;
    case "yearly":
      next = addYears(from, n);
      break;
    case "custom":
      next = addDays(from, n);
      break;
    default:
      return null;
  }
  if (rule.recurrence_end && toDateKey(next) > rule.recurrence_end) return null;
  return next;
}

/**
 * The next occurrence that is still actionable: advances past missed slots so a
 * daily task completed a week late lands on today, not a week ago.
 */
export function nextPendingOccurrence(rule: RecurrenceRule, scheduled: Date, now = new Date()): Date | null {
  let next = nextOccurrenceDate(rule, scheduled);
  let guard = 0;
  while (next && startOfDay(next) < startOfDay(now) && guard++ < 500) {
    next = nextOccurrenceDate(rule, next);
  }
  return next;
}

/** Shift both dates by the same calendar-day distance, preserving their gap and due time. */
export function nextInstanceDates(task: TaskLike & RecurrenceRule, now = new Date()) {
  const due = task.due_at ? new Date(task.due_at) : null;
  const anchor = parsePlanned(task.planned_date) ?? due;
  if (!anchor) return null;
  const next = nextPendingOccurrence(task, anchor, now);
  if (!next) return null;
  const shift = differenceInCalendarDays(next, anchor);
  return {
    due_at: due ? addDays(due, shift).toISOString() : null,
    planned_date: task.planned_date ? toDateKey(next) : null,
  };
}

/** Human-readable summary, e.g. "Every 2 weeks on Mon, Wed until Jun 1". */
export function describeRecurrence(rule: RecurrenceRule): string {
  if (rule.recurrence === "none") return "Never";
  const n = intervalOf(rule);
  const opt = RECURRENCE_OPTIONS.find((o) => o.id === rule.recurrence);
  let base = opt?.label ?? rule.recurrence;
  if (rule.recurrence === "custom") base = `Every ${n} day${n > 1 ? "s" : ""}`;
  if (rule.recurrence === "weekly" && rule.recurrence_days?.length) {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    base = `Weekly on ${rule.recurrence_days
      .slice()
      .sort((a, b) => a - b)
      .map((d) => names[d])
      .join(", ")}`;
  }
  if (rule.recurrence_end) base += ` until ${rule.recurrence_end}`;
  return base;
}
