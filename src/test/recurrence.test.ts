import { describe, expect, it } from "vitest";
import { describeRecurrence, effectiveRecurrenceEnd, nextInstanceDates, nextOccurrenceDate, nextPendingOccurrence } from "@/lib/recurrence";
import { calendarDays, dateKeyInTimeZone, dateTimeInputInTimeZone, dateTimeInTimeZoneToIso } from "@/lib/task-utils";

type T = { id: string; recurrence_parent_id: string | null; status: string; planned_date: string | null; due_at: string | null; recurrence: string; recurrence_interval?: number; recurrence_days?: number[] | null; recurrence_end: string | null };

/** Simulate completing each occurrence and collect the whole series. */
function series(start: T[]): T[];
function series(start: T): T[];
function series(start: T | T[]): T[] {
  const initial = Array.isArray(start) ? start : [start];
  const all: T[] = [...initial];
  let cur = initial[0];
  for (let i = 0; i < 100; i++) {
    const p = nextInstanceDates(cur, new Date(`${cur.planned_date}T00:00:00`));
    if (!p) break;
    cur = { ...cur, id: `${cur.id}-${i}`, recurrence_parent_id: initial[0].id, ...p };
    all.push(cur);
  }
  return all;
}
const work = (s: T[]) => s.map((t) => t.planned_date);
const base = (o: Partial<T>): T => ({ id: "s", recurrence_parent_id: null, status: "todo", planned_date: "2026-11-09", due_at: null, recurrence: "daily", recurrence_end: null, ...o });
const dueOn = (d: string) => new Date(`${d}T23:59:00`).toISOString();
const deadlineDays = (s: T[]) => [...calendarDays(s).entries()].filter(([, e]) => e.deadlines.length).map(([k, e]) => [k, e.deadlines.length]);
const totalDue = (s: T[]) => [...calendarDays(s).values()].reduce((n, e) => n + e.dueCount, 0);

describe("recurrence intervals and weekday selection", () => {
  it("keeps selected weekdays in the current eligible week", () => {
    const rule = { recurrence: "weekly", recurrence_days: [1, 3] };
    expect(work(series(base({ recurrence: "weekly", recurrence_days: [1, 3] })))).toEqual(["2026-11-09", "2026-11-11", "2026-11-16", "2026-11-18"]);
    expect(nextOccurrenceDate(rule, new Date(2026, 10, 10))?.getDate()).toBe(11);
  });
  it("honors every-N-weeks when weekdays are selected", () => {
    const rule = { recurrence: "weekly", recurrence_interval: 2, recurrence_days: [1, 3] };
    const start = new Date(2026, 10, 9);
    expect(nextOccurrenceDate(rule, start)?.getDate()).toBe(11);
    expect(nextOccurrenceDate(rule, new Date(2026, 10, 11))?.toDateString()).toBe(new Date(2026, 10, 23).toDateString());
    expect(describeRecurrence(rule)).toBe("Every 2 weeks on Mon, Wed");
  });
  it("deduplicates invalid and repeated weekday values", () => {
    expect(nextOccurrenceDate({ recurrence: "weekly", recurrence_days: [1, 1, 9, -1] }, new Date(2026, 10, 9))?.getDate()).toBe(16);
  });
  it("clamps monthly recurrence to the last day of shorter months", () => {
    const next = nextOccurrenceDate({ recurrence: "monthly" }, new Date(2026, 0, 31));
    expect(next?.getFullYear()).toBe(2026);
    expect(next?.getMonth()).toBe(1);
    expect(next?.getDate()).toBe(28);
  });
  it("keeps leap-day yearly recurrence on the last day of February", () => {
    const next = nextOccurrenceDate({ recurrence: "yearly" }, new Date(2024, 1, 29));
    expect(next?.getFullYear()).toBe(2025);
    expect(next?.getMonth()).toBe(1);
    expect(next?.getDate()).toBe(28);
  });
  it("applies intervals to biweekly recurrence", () => {
    expect(nextOccurrenceDate({ recurrence: "biweekly", recurrence_interval: 2 }, new Date(2026, 10, 9))?.getDate()).toBe(7);
  });
  it("catches up a daily series after more than 500 missed days", () => {
    const next = nextPendingOccurrence({ recurrence: "daily" }, new Date(2024, 0, 1), new Date(2026, 10, 11));
    expect(next?.getFullYear()).toBe(2026);
    expect(next?.getMonth()).toBe(10);
    expect(next?.getDate()).toBe(12);
  });
  it("skips missed occurrences without exceeding the recurrence end", () => {
    expect(nextPendingOccurrence({ recurrence: "daily", recurrence_end: "2026-11-12" }, new Date(2026, 10, 9), new Date(2026, 10, 13))).toBeNull();
  });
});

describe("saved time zone calendar bucketing", () => {
  it("places an instant on the correct local calendar day", () => {
    const instant = new Date("2026-11-12T02:00:00.000Z");
    expect(dateKeyInTimeZone(instant, "America/Denver")).toBe("2026-11-11");
  });
  it("round-trips task deadline inputs through the saved time zone", () => {
    const iso = "2026-11-12T02:00:00.000Z";
    const inputs = dateTimeInputInTimeZone(iso, "America/Denver");
    expect(inputs).toEqual({ date: "2026-11-11", time: "19:00" });
    expect(dateTimeInTimeZoneToIso(inputs.date, inputs.time, "America/Denver")).toBe(iso);
  });
  it("counts a deadline in the selected time zone", () => {
    const task = base({ due_at: "2026-11-12T02:00:00.000Z" });
    const days = calendarDays([task], "America/Denver");
    expect(days.get("2026-11-11")?.dueCount).toBe(1);
    expect(days.has("2026-11-12")).toBe(false);
  });
});

describe("1. deadline only: series ends at the deadline", () => {
  it("daily through the deadline, one red indicator", () => {
    const s = series(base({ due_at: dueOn("2026-11-13") }));
    expect(work(s)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]);
    expect(s.every((t) => t.due_at === dueOn("2026-11-13"))).toBe(true);
    expect(deadlineDays(s)).toEqual([["2026-11-13", 1]]);
    expect(totalDue(s)).toBe(1);
  });
  it("weekdays skip the weekend", () => {
    expect(work(series(base({ planned_date: "2026-11-12", recurrence: "weekdays", due_at: dueOn("2026-11-17") })))).toEqual(["2026-11-12", "2026-11-13", "2026-11-16", "2026-11-17"]);
  });
  it("weekly on chosen days", () => {
    expect(work(series(base({ recurrence: "weekly", recurrence_days: [1, 3], due_at: dueOn("2026-11-20") })))).toEqual(["2026-11-09", "2026-11-11", "2026-11-16", "2026-11-18"]);
  });
});

describe("2. no deadline + repeat until", () => {
  it("runs through the end date with no red indicator", () => {
    const s = series(base({ recurrence_end: "2026-11-12" }));
    expect(work(s)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(deadlineDays(s)).toEqual([]);
    expect(totalDue(s)).toBe(0);
  });
  it("end date off-schedule stops at the last valid occurrence", () => {
    expect(work(series(base({ recurrence: "weekdays", planned_date: "2026-11-12", recurrence_end: "2026-11-15" })))).toEqual(["2026-11-12", "2026-11-13"]);
  });
});

describe("3. deadline + separate repeat end", () => {
  it("end earlier than deadline: banners stop early, deadline kept", () => {
    const s = series(base({ due_at: dueOn("2026-11-20"), recurrence_end: "2026-11-11" }));
    expect(work(s)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(deadlineDays(s)).toEqual([["2026-11-20", 1]]);
  });
  it("end later than deadline: banners continue, still one deadline", () => {
    const s = series(base({ due_at: dueOn("2026-11-10"), recurrence_end: "2026-11-12" }));
    expect(work(s)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(deadlineDays(s)).toEqual([["2026-11-10", 1]]);
    expect(totalDue(s)).toBe(1);
  });
});

describe("series deadline counting and edits", () => {
  it("completed instances don't duplicate the deadline; open one is counted", () => {
    const s = series(base({ due_at: dueOn("2026-11-12") })).map((t, i, a) => ({ ...t, status: i < a.length - 1 ? "done" : "todo" }));
    expect(deadlineDays(s)).toEqual([["2026-11-12", 1]]);
    expect(totalDue(s)).toBe(1);
  });
  it("removing the deadline uses repeat until; end is never a deadline", () => {
    expect(effectiveRecurrenceEnd({ due_at: null, recurrence_end: "2026-11-30" })).toBe("2026-11-30");
    expect(effectiveRecurrenceEnd({ due_at: dueOn("2026-11-14"), recurrence_end: null })).toBe("2026-11-14");
  });
  it("saved MathXL settings (weekdays, end Nov 17) keep their deadline fixed", () => {
    const s = series(base({ planned_date: "2026-11-11", recurrence: "weekdays", due_at: "2026-11-12T04:00:00Z", recurrence_end: "2026-11-17" }));
    expect(work(s)).toEqual(["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16", "2026-11-17"]);
    expect(s.every((t) => t.due_at === "2026-11-12T04:00:00Z")).toBe(true);
  });
  it("end date includes an evening slot", () => {
    expect(nextOccurrenceDate({ recurrence: "daily", recurrence_end: "2026-11-13" }, new Date(2026, 10, 12, 23, 59))?.getDate()).toBe(13);
    expect(nextOccurrenceDate({ recurrence: "daily", recurrence_end: "2026-11-13" }, new Date(2026, 10, 13, 23, 59))).toBeNull();
  });
  it("catch-up skips missed slots", () => {
    expect(nextInstanceDates(base({ planned_date: "2026-11-02", recurrence_end: "2026-11-30" }), new Date(2026, 10, 7))?.planned_date).toBe("2026-11-07");
  });
});
