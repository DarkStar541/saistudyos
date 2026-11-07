import { describe, expect, it } from "vitest";
import { addDays, differenceInCalendarDays } from "date-fns";
import { nextInstanceDates, nextOccurrenceDate } from "@/lib/recurrence";
import { calendarDays, isUpcoming, toDateKey } from "@/lib/task-utils";

// Literal saved scheduling settings; UTC deadlines are converted to the viewer's local day.
const actual = [
  { title: "MathXL", status: "todo", planned_date: "2026-11-11", due_at: "2026-11-12T04:00:00Z", recurrence: "weekdays", recurrence_interval: 1, recurrence_days: null, recurrence_end: "2026-11-17" },
  { title: "Catapult Design", status: "done", planned_date: "2026-11-09", due_at: "2026-11-09T06:59:00Z", recurrence: "weekdays", recurrence_interval: 1, recurrence_days: null, recurrence_end: "2026-11-13" },
];

describe("saved MathXL and Catapult Design recurrence settings", () => {
  for (const saved of actual) {
    it(`${saved.title}: every remaining weekday preserves both dates, counts and upcoming eligibility`, () => {
      const expected = saved.title === "MathXL" ? ["2026-11-12", "2026-11-13", "2026-11-16", "2026-11-17"] : ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
      let task = { ...saved, status: "todo" };
      const dates: string[] = [];
      for (const workDate of expected) {
        const previous = task;
        const patch = nextInstanceDates(task, new Date(`${task.planned_date}T00:00:00`));
        expect(patch?.planned_date).toBe(workDate);
        if (!patch?.planned_date || !patch.due_at) throw new Error("Missing recurrence dates");
        task = { ...task, planned_date: patch.planned_date, due_at: patch.due_at };
        const shift = differenceInCalendarDays(new Date(`${workDate}T00:00`), new Date(`${previous.planned_date}T00:00`));
        expect(task.due_at).toBe(addDays(new Date(previous.due_at), shift).toISOString());
        const days = calendarDays([task]);
        expect(days.get(workDate)?.work).toEqual([task]);
        expect(days.get(toDateKey(new Date(task.due_at)))?.deadlines).toEqual([task]);
        expect([...days.values()].reduce((n, d) => n + d.dueCount, 0)).toBe(1);
        expect(isUpcoming(task, 30, addDays(new Date(task.due_at), -1))).toBe(true);
        dates.push(workDate);
      }
      expect(dates).toEqual(expected);
      expect(nextInstanceDates(task, new Date(`${task.planned_date}T00:00`))).toBeNull();
    });
  }
});

describe("recurring dual-date edges", () => {
  it.each([-2, 0, 2])("preserves a due-date offset of %i days", (offset) => {
    const work = new Date(2026, 10, 6);
    const due = addDays(work, offset);
    due.setHours(21, 15, 22, 123);
    const patch = nextInstanceDates({ status: "todo", planned_date: "2026-11-06", due_at: due.toISOString(), recurrence: "weekdays" }, work);
    expect(patch?.planned_date).toBe("2026-11-09");
    expect(patch?.due_at).toBe(addDays(due, 3).toISOString());
  });
  it("includes the end date even with an evening deadline", () => {
    expect(nextOccurrenceDate({ recurrence: "daily", recurrence_end: "2026-11-13" }, new Date(2026, 10, 12, 23, 59))?.getDate()).toBe(13);
    expect(nextOccurrenceDate({ recurrence: "daily", recurrence_end: "2026-11-13" }, new Date(2026, 10, 13, 23, 59))).toBeNull();
  });
  it("catch-up skips missed work slots without collapsing the deadline gap", () => {
    const task = { status: "todo", planned_date: "2026-11-02", due_at: new Date(2026, 10, 4, 21).toISOString(), recurrence: "weekdays" };
    const patch = nextInstanceDates(task, new Date(2026, 10, 7));
    expect(patch?.planned_date).toBe("2026-11-09");
    expect(patch?.due_at).toBe(new Date(2026, 10, 11, 21).toISOString());
  });
  it("preserves deadline-only and work-only schedules", () => {
    const due = new Date(2026, 10, 6, 21);
    expect(nextInstanceDates({ status: "todo", due_at: due.toISOString(), planned_date: null, recurrence: "weekdays" }, due)).toEqual({ due_at: addDays(due, 3).toISOString(), planned_date: null });
    expect(nextInstanceDates({ status: "todo", due_at: null, planned_date: "2026-11-06", recurrence: "weekdays" }, due)).toEqual({ due_at: null, planned_date: "2026-11-09" });
  });
});