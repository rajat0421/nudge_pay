import { supabase, unwrap, unwrapVoid } from "../db/supabase";
import { logger } from "../config/logger";
import { computeTimeBasedStatus } from "../modules/invoices/invoices.status";

interface OrgTimezone {
  id: string;
  timezone: string;
}

interface InvoiceStatusRow {
  id: string;
  dueDate: string;
  status: string;
}

/**
 * Invoice statuses are date-driven (SENT -> DUE -> OVERDUE) rather than
 * event-driven, so they can't be updated at the moment they change — nothing
 * "happens" when a due date quietly passes. This sweep runs every tick
 * (see jobs/runner.ts) and re-derives the status for every non-terminal,
 * non-draft invoice per organization, in that organization's own timezone.
 */
export async function syncInvoiceStatuses(): Promise<{ checked: number; updated: number }> {
  const organizations = unwrap<OrgTimezone[]>(
    await supabase.from("organizations").select("id, timezone"),
  );

  let checked = 0;
  let updated = 0;

  for (const organization of organizations ?? []) {
    const invoices = unwrap<InvoiceStatusRow[]>(
      await supabase
        .from("invoices")
        .select("id, dueDate, status")
        .eq("organizationId", organization.id)
        .in("status", ["SENT", "DUE", "OVERDUE"]),
    );

    for (const invoice of invoices ?? []) {
      checked += 1;
      const nextStatus = computeTimeBasedStatus(new Date(invoice.dueDate), organization.timezone);
      if (nextStatus !== invoice.status) {
        unwrapVoid(
          await supabase.from("invoices").update({ status: nextStatus }).eq("id", invoice.id),
        );
        updated += 1;
      }
    }
  }

  if (updated > 0) {
    logger.info({ checked, updated }, "invoice status sweep updated statuses");
  }

  return { checked, updated };
}
