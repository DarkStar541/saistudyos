import { describe, expect, it } from "vitest";
import { aiQuickAddProposalSchema } from "@/lib/ai-quick-add";

const valid = {
  title: "Physics lab report",
  description: null,
  courseId: "a7c1a5a0-8b7c-4a33-9c0b-1b3e9f5d7a10",
  courseName: "Physics",
  courseUnresolved: false,
  taskType: "lab",
  priority: "high",
  dueDate: "2026-11-20",
  dueTime: "23:59",
  plannedDate: "2026-11-19",
  estimatedMinutes: 60,
  clarificationQuestion: null,
};

describe("AI Quick Add proposal validation", () => {
  it("accepts a valid, fully structured proposal", () => {
    expect(aiQuickAddProposalSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a personal task without a course or dates", () => {
    expect(aiQuickAddProposalSchema.safeParse({
      ...valid, courseId: null, courseName: null, dueDate: null, dueTime: null, plannedDate: null,
    }).success).toBe(true);
  });

  it("rejects an unknown task type", () => {
    expect(aiQuickAddProposalSchema.safeParse({ ...valid, taskType: "homework-ish" }).success).toBe(false);
  });

  it("rejects malformed course identifiers", () => {
    expect(aiQuickAddProposalSchema.safeParse({ ...valid, courseId: "another-user-course" }).success).toBe(false);
  });

  it("rejects malformed dates and times", () => {
    expect(aiQuickAddProposalSchema.safeParse({ ...valid, dueDate: "next Friday" }).success).toBe(false);
    expect(aiQuickAddProposalSchema.safeParse({ ...valid, dueTime: "25:90" }).success).toBe(false);
  });

  it("rejects oversized titles and unexpected model fields", () => {
    expect(aiQuickAddProposalSchema.safeParse({ ...valid, title: "x".repeat(161) }).success).toBe(false);
    expect(aiQuickAddProposalSchema.safeParse({ ...valid, userId: "attacker-controlled" }).success).toBe(false);
  });

  it("rejects negative or excessive estimated duration", () => {
    expect(aiQuickAddProposalSchema.safeParse({ ...valid, estimatedMinutes: -1 }).success).toBe(false);
    expect(aiQuickAddProposalSchema.safeParse({ ...valid, estimatedMinutes: 10001 }).success).toBe(false);
  });
});
