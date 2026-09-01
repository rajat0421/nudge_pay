import { z } from "zod";

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  currency: z.string().trim().length(3).optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
