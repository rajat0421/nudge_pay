import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";

export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  companyName: z.string().trim().max(160).optional(),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial();
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const clientIdParamsSchema = z.object({ id: z.string().uuid() });
export type ClientIdParams = z.infer<typeof clientIdParamsSchema>;

export const listClientsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(["name", "email", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
