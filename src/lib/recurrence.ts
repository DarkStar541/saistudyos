// Recurrence engine for repeating tasks. Pure functions, tested in src/test/recurrence.test.ts.
import { addDays, addMonths, addYears, startOfDay, startOfWeek } from "date-fns";
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

const intervalOf = (r: RecurrenceRule) => Math.max(1, Math.min(365, Math.floor(r.recurrence_interval ?? 1)));
const DAY_MS = 24 * 60 * 60 * 1000;

/** Preserve the day-of-month where possible; clamp month-end dates instead of overflowing. */
function addMonthsClamped(date: Date, amount: number): Date {
  const target = addMonths(date, amount);
  if (target.getDate() !== date.getDate()) target.setDate(0);
  return target;
}

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
      const days = [...new Set((rule.recurrence_days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
      if (days.length) {
        // Selected weekdays may still occur later in the current week. Subsequent
        // eligible weeks are anchored to the week containing the current occurrence.
        const anchorWeek = startOfWeek(from, { weekStartsOn: 0 });
        for (let offset = 1; offset <= 7 * n + 6; offset++) {
          const candidate = addDays(from, offset);
          const weekOffset = Math.floor((startOfDay(candidate).getTime() - startOfDay(anchorWeek).getTime()) / (7 * DAY_MS));
          if (weekOffset % n === 0 && days.includes(candidate.getDay())) {
            next = candidate;
            break;
          }
        }
      } else {
        next = addDays(from, 7 * n);
      }
      break;
    }
    case "biweekly":
      next = addDays(from, 14 * n);
      break;
    case "monthly":
      next = addMonthsClamped(from, n);
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

/**
 * The day a series stops: an explicit "repeat until" date wins; otherwise the
 * deadline ends the series. The deadline itself never moves.
 */
export function effectiveRecurrenceEnd(task: { due_at: string | null; recurrence_end?: string | null }): string | null {
  if (task.recurrence_end) return task.recurrence_end;
  return task.due_at ? toDateKey(new Date(task.due_at)) : null;
}

/** Next work occurrence of a series; the deadline stays fixed (one deadline per series). */
export function nextInstanceDates(task: TaskLike & RecurrenceRule, now = new Date()) {
  const anchor = parsePlanned(task.planned_date);
  if (!anchor) return null;
  const next = nextPendingOccurrence({ ...task, recurrence_end: effectiveRecurrenceEnd(task) }, anchor, now);
  if (!next) return null;
  return { due_at: task.due_at, planned_date: toDateKey(next) };
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
    const selected = [...new Set(rule.recurrence_days)]
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b)
      .map((d) => names[d]);
    base = `${n > 1 ? `Every ${n} weeks` : "Weekly"}${selected.length ? ` on ${selected.join(", ")}` : ""}`;
  }
  if (rule.recurrence === "weekly" && n > 1 && !rule.recurrence_days?.length) base = `Every ${n} weeks`;
  if (rule.recurrence === "biweekly" && n > 1) base = `Every ${2 * n} weeks`;
  if (rule.recurrence_end) base += ` until ${rule.recurrence_end}`;
  return base;
}
