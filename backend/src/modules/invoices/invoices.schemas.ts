import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Must be a valid ISO date string",
});

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(80),
  // Major units in the request/response (e.g. dollars); stored internally as minor units.
  amount: z.number().positive(),
  currency: z.string().trim().length(3).default("USD"),
  issueDate: isoDate,
  dueDate: isoDate,
  paymentUrl: z.string().trim().url().optional().or(z.literal("")),
  reminderSequenceId: z.string().uuid().optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceSchema = z.object({
  clientId: z.string().uuid().optional(),
  invoiceNumber: z.string().trim().min(1).max(80).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().trim().length(3).optional(),
  issueDate: isoDate.optional(),
  dueDate: isoDate.optional(),
  paymentUrl: z.string().trim().url().optional().or(z.literal("")),
  reminderSequenceId: z.string().uuid().nullable().optional(),
  status: z.enum(["CANCELLED"]).optional(),
});
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const invoiceIdParamsSchema = z.object({ id: z.string().uuid() });
export type InvoiceIdParams = z.infer<typeof invoiceIdParamsSchema>;

export const listInvoicesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["DRAFT", "SENT", "DUE", "OVERDUE", "PAID", "CANCELLED"]).optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(["dueDate", "createdAt", "amount", "invoiceNumber"]).default("dueDate"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
