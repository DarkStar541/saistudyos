import { describe, expect, it } from "vitest";
import { isForToday, isOverdue, nextOccurrence, weeklyWorkload } from "@/lib/task-utils";

const now = new Date(2026, 10, 4, 12, 0); // Wed Nov 4 2026 noon local

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
