import { prisma } from "../../db/prisma";
import { logger } from "../../config/logger";

export interface RecordAuditLogInput {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit trail for every important mutation (business rule
 * #10). Deliberately never throws — losing an audit row must never fail the
 * user-facing request that triggered it.
 */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    logger.warn({ err: error, action: input.action }, "failed to write audit log");
  }
}
