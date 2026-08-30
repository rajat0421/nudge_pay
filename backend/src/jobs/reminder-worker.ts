import { prisma } from "../db/prisma";
import { logger } from "../config/logger";
import { formatMinorUnits } from "../utils/money";
import { formatCalendarDate } from "../utils/dates";
import { sendEmail } from "../modules/email/email.service";
import { renderTemplate, toHtml, type TemplateVariables } from "../modules/email/templates";
import { recordAuditLog } from "../modules/audit/audit.service";
import * as remindersRepository from "../modules/reminders/reminders.repository";
import { handleSendFailure } from "./retry-worker";

type ClaimedEvent = Awaited<ReturnType<typeof remindersRepository.claimDueEvents>>[number];

export interface ReminderWorkerResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

const DEFAULT_BATCH_SIZE = 20;

/** Re-checks the invoice's *current* state right before sending — the claim
 * lock only protects the reminder_events row, not the invoice row, so a
 * payment/cancellation/pause that landed after claiming must still win. */
async function isInvoiceStillEligible(invoiceId: string): Promise<boolean> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, remindersPaused: true },
  });
  if (!invoice) return false;
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") return false;
  if (invoice.remindersPaused) return false;
  return true;
}

function buildTemplateVariables(event: ClaimedEvent): TemplateVariables {
  const { invoice, organization } = event;
  return {
    client_name: invoice.client.name,
    company_name: organization.name,
    invoice_number: invoice.invoiceNumber,
    amount: formatMinorUnits(invoice.amount, invoice.currency),
    due_date: formatCalendarDate(invoice.dueDate),
    payment_url: invoice.paymentUrl ?? "",
  };
}

async function processEvent(event: ClaimedEvent): Promise<"sent" | "skipped" | "failed"> {
  const eligible = await isInvoiceStillEligible(event.invoiceId);
  if (!eligible) {
    await remindersRepository.markEventCancelled(event.id);
    logger.info({ eventId: event.id, invoiceId: event.invoiceId }, "reminder skipped — invoice no longer eligible");
    return "skipped";
  }

  const variables = buildTemplateVariables(event);
  const template = event.reminderStep.emailTemplate;
  const subject = renderTemplate(template.subject, variables);
  const body = renderTemplate(template.body, variables);

  try {
    const result = await sendEmail({
      to: event.invoice.client.email,
      subject,
      html: toHtml(body),
      fromName: event.organization.name,
      text: body,
      metadata: { invoiceId: event.invoiceId, reminderEventId: event.id },
    });

    await remindersRepository.markEventSent(event.id, result.providerMessageId);
    await recordAuditLog({
      organizationId: event.organizationId,
      action: "reminder.sent",
      entityType: "ReminderEvent",
      entityId: event.id,
      metadata: { invoiceId: event.invoiceId, step: event.reminderStep.stepOrder },
    });
    return "sent";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await handleSendFailure({ eventId: event.id, attempts: event.attempts + 1, error: message });
    return "failed";
  }
}

/**
 * Core reminder dispatch loop — claims a batch of due events and processes
 * them one at a time. Called on every tick by jobs/runner.ts.
 */
export async function runReminderWorker(batchSize = DEFAULT_BATCH_SIZE): Promise<ReminderWorkerResult> {
  const events = await remindersRepository.claimDueEvents(batchSize);
  const result: ReminderWorkerResult = { processed: events.length, sent: 0, skipped: 0, failed: 0 };

  for (const event of events) {
    const outcome = await processEvent(event);
    result[outcome] += 1;
  }

  if (result.processed > 0) {
    logger.info(result, "reminder worker tick complete");
  }

  return result;
}
