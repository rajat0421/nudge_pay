import { z } from "zod";

/**
 * Wraps a data schema in the API's standard `{ success, data }` envelope for
 * Swagger documentation. Deliberately permissive on nested shapes (Prisma
 * models carry Date/Decimal fields that are awkward to mirror exactly in
 * zod) — the envelope's top-level shape is what callers can rely on.
 */
export function successEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({ success: z.literal(true), data: dataSchema });
}

export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export const paginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export function paginatedEnvelope<T extends z.ZodTypeAny>(itemSchema: T) {
  return successEnvelope(
    z.object({
      items: z.array(itemSchema),
      pagination: paginationMetaSchema,
    }),
  );
}
