import { prisma } from "../db/prisma";
import { logger } from "../config/logger";
import { computeTimeBasedStatus } from "../modules/invoices/invoices.status";

/**
 * Invoice statuses are date-driven (SENT -> DUE -> OVERDUE) rather than
 * event-driven, so they can't be updated at the moment they change — nothing
 * "happens" when a due date quietly passes. This sweep runs every tick
 * (see jobs/runner.ts) and re-derives the status for every non-terminal,
 * non-draft invoice per organization, in that organization's own timezone.
 */
export async function syncInvoiceStatuses(): Promise<{ checked: number; updated: number }> {
  const organizations = await prisma.organization.findMany({
    select: { id: true, timezone: true },
  });

  let checked = 0;
  let updated = 0;

  for (const organization of organizations) {
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: organization.id, status: { in: ["SENT", "DUE", "OVERDUE"] } },
      select: { id: true, dueDate: true, status: true },
    });

    for (const invoice of invoices) {
      checked += 1;
      const nextStatus = computeTimeBasedStatus(invoice.dueDate, organization.timezone);
      if (nextStatus !== invoice.status) {
        await prisma.invoice.update({ where: { id: invoice.id }, data: { status: nextStatus } });
        updated += 1;
      }
    }
  }

  if (updated > 0) {
    logger.info({ checked, updated }, "invoice status sweep updated statuses");
  }

  return { checked, updated };
}
