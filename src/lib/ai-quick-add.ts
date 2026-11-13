import { z } from "zod";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const aiQuickAddProposalSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(1000).nullable(),
  courseId: z.string().uuid().nullable(),
  courseName: z.string().max(120).nullable(),
  courseUnresolved: z.boolean(),
  taskType: z.enum(["assignment", "homework", "exam", "quiz", "lab", "reading", "essay", "project", "study", "other"]),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: dateKey,
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  plannedDate: dateKey,
  estimatedMinutes: z.number().int().min(0).max(10000).nullable(),
  clarificationQuestion: z.string().max(180).nullable(),
}).strict();

export type AiQuickAddProposal = z.infer<typeof aiQuickAddProposalSchema>;
