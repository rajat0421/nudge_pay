import type { InvoiceStatus } from "@prisma/client";
import { addCalendarDays, isCalendarDatePastInOrgTimezone } from "../../utils/dates";

const DUE_SOON_WINDOW_DAYS = 3;

/**
 * Terminal statuses are never touched by the time-based sweep — once an
 * invoice is PAID or CANCELLED it stays that way regardless of due date.
 */
export function isTerminalStatus(status: InvoiceStatus): boolean {
  return status === "PAID" || status === "CANCELLED";
}

/**
 * Computes the *time-driven* status for an active (non-draft, non-terminal)
 * invoice: SENT while the due date is comfortably in the future, DUE once
 * it's within the due-soon window, OVERDUE once the org-local due date has
 * fully passed. Used both at invoice creation and by the periodic sweep in
 * jobs/reminder-scheduler.ts.
 */
export function computeTimeBasedStatus(
  dueDate: Date,
  organizationTimezone: string,
  now: Date = new Date(),
): "SENT" | "DUE" | "OVERDUE" {
  if (isCalendarDatePastInOrgTimezone(dueDate, organizationTimezone, now)) {
    return "OVERDUE";
  }
  const dueSoonThreshold = addCalendarDays(dueDate, -DUE_SOON_WINDOW_DAYS);
  if (isCalendarDatePastInOrgTimezone(dueSoonThreshold, organizationTimezone, now)) {
    return "DUE";
  }
  return "SENT";
}
