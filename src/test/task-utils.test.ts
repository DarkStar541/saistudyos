import { describe, expect, it } from "vitest";
import {
  calendarDays,
  isForToday,
  isOverdue,
  isUpcoming,
  nextOccurrence,
  todayProgress,
  weeklyWorkload,
} from "@/lib/task-utils";

const now = new Date(2026, 10, 4, 12, 0); // Wed Nov 4 2026 noon local

describe("today progress", () => {
  it("shows a full remaining-work ring when both of today's tasks are unfinished", () => {
    const tasks = [
      { status: "todo", due_at: null, planned_date: "2026-11-04" },
      { status: "in_progress", due_at: null, planned_date: "2026-11-04" },
    ];
    expect(todayProgress(tasks, now)).toEqual({
      completed: 0,
      remaining: 2,
      total: 2,
      completionRatio: 0,
      remainingRatio: 1,
    });
  });

  it("splits today's progress evenly when one of two scheduled tasks is completed today", () => {
    const tasks = [
      {
        status: "done",
        due_at: null,
        planned_date: "2026-11-04",
        completed_at: new Date(2026, 10, 4, 10).toISOString(),
      },
      { status: "todo", due_at: null, planned_date: "2026-11-04", completed_at: null },
    ];
    expect(todayProgress(tasks, now)).toEqual({
      completed: 1,
      remaining: 1,
      total: 2,
      completionRatio: 0.5,
      remainingRatio: 0.5,
    });
  });

  it("removes a task from today's gauge when its work date is moved to tomorrow", () => {
    const tasks = [
      { status: "todo", due_at: new Date(2026, 10, 7, 23, 59).toISOString(), planned_date: "2026-11-04" },
      { status: "todo", due_at: new Date(2026, 10, 7, 23, 59).toISOString(), planned_date: "2026-11-05" },
    ];
    expect(todayProgress(tasks, now)).toMatchObject({
      completed: 0,
      remaining: 1,
      total: 1,
      completionRatio: 0,
      remainingRatio: 1,
    });
  });

  it("does not count work completed on a different day in today's gauge", () => {
    const tasks = [
      {
        status: "done",
        due_at: null,
        planned_date: "2026-11-04",
        completed_at: new Date(2026, 10, 3, 23).toISOString(),
      },
    ];
    expect(todayProgress(tasks, now).total).toBe(0);
  });
});

describe("dual dates", () => {
  it("a task due Friday but planned for today shows in Today", () => {
    expect(isForToday({ status: "todo", due_at: new Date(2026, 10, 6, 23, 59).toISOString(), planned_date: "2026-11-04" }, now)).toBe(true);
  });
  it("a task due today but planned for tomorrow does not show in Today", () => {
    expect(isForToday({ status: "todo", due_at: new Date(2026, 10, 4, 23, 59).toISOString(), planned_date: "2026-11-05" }, now)).toBe(false);
  });
  it("overdue is based on the deadline, not the work date", () => {
    expect(isOverdue({ status: "todo", due_at: new Date(2026, 10, 3).toISOString(), planned_date: "2026-11-10" }, now)).toBe(true);
    expect(isOverdue({ status: "done", due_at: new Date(2026, 10, 3).toISOString(), planned_date: null }, now)).toBe(false);
  });
  it("workload counts minutes on the planned day", () => {
    const days = weeklyWorkload([{ status: "todo", due_at: new Date(2026, 10, 8).toISOString(), planned_date: "2026-11-04", estimated_minutes: 90 }], now, 1);
    expect(days.find((d) => d.key === "2026-11-04")?.minutes).toBe(90);
    expect(days.find((d) => d.key === "2026-11-08")?.minutes).toBe(0);
  });
  it("weekly recurrence moves 7 days", () => {
    expect(nextOccurrence("weekly", new Date(2026, 10, 4))?.getDate()).toBe(11);
  });
});

describe("independent calendar dates", () => {
  const due = new Date(2026, 10, 6, 23, 59).toISOString();
  it.each(["2026-11-05", "2026-11-06", "2026-11-07"])("work on %s never changes the Nov 6 deadline count", (planned_date) => {
    const task = { status: "todo", due_at: due, planned_date };
    const days = calendarDays([task]);
    expect(days.get(planned_date)?.work).toEqual([task]);
    expect(days.get("2026-11-06")?.deadlines).toEqual([task]);
    expect(days.get("2026-11-06")?.dueCount).toBe(1);
    expect([...days.values()].reduce((n, d) => n + d.dueCount, 0)).toBe(1);
    expect(isUpcoming(task, 7, now)).toBe(true);
  });
  it("represents every task sharing a deadline, not just four", () => {
    const tasks = Array.from({ length: 6 }, (_, id) => ({ id: String(id), status: "todo", due_at: due, planned_date: "2026-11-05" }));
    const day = calendarDays(tasks).get("2026-11-06");
    expect(day?.deadlines).toHaveLength(6);
    expect(day?.dueCount).toBe(6);
    expect(day?.work).toHaveLength(0);
  });
  it("deadline-only tasks have no work banner and completed deadlines do not increase counts", () => {
    const days = calendarDays([{ status: "todo", due_at: due, planned_date: null }, { status: "done", due_at: due, planned_date: "2026-11-06" }]);
    expect(days.get("2026-11-06")?.dueCount).toBe(1);
    expect(days.get("2026-11-06")?.work).toHaveLength(1);
  });
});
