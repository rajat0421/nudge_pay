import { z } from "zod";

export const createReminderSequenceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().default(true),
  steps: z
    .array(
      z.object({
        delayDays: z.number().int(),
        subject: z.string().trim().min(1).max(200),
        body: z.string().trim().min(1).max(5000),
      }),
    )
    .min(1, "At least one reminder step is required"),
});
export type CreateReminderSequenceInput = z.infer<typeof createReminderSequenceSchema>;

export const updateReminderSequenceSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateReminderSequenceInput = z.infer<typeof updateReminderSequenceSchema>;

export const updateReminderStepSchema = z.object({
  delayDays: z.number().int().optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
});
export type UpdateReminderStepInput = z.infer<typeof updateReminderStepSchema>;

export const reminderSequenceIdParamsSchema = z.object({ id: z.string().uuid() });
export type ReminderSequenceIdParams = z.infer<typeof reminderSequenceIdParamsSchema>;

export const reminderStepParamsSchema = z.object({
  id: z.string().uuid(),
  stepId: z.string().uuid(),
});
export type ReminderStepParams = z.infer<typeof reminderStepParamsSchema>;
