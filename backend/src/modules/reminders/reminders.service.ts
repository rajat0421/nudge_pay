import { ConflictError, NotFoundError, ValidationError } from "../../utils/errors";
import { addCalendarDays, orgLocalMidnightUtc, toCalendarDate } from "../../utils/dates";
import { recordAuditLog } from "../audit/audit.service";
import * as remindersRepository from "./reminders.repository";
import type {
  CreateReminderSequenceInput,
  UpdateReminderSequenceInput,
  UpdateReminderStepInput,
} from "./reminders.schemas";

export async function listSequences(organizationId: string) {
  return remindersRepository.listSequences(organizationId);
}

export async function getSequence(organizationId: string, id: string) {
  const sequence = await remindersRepository.findSequenceById(organizationId, id);
  if (!sequence) throw new NotFoundError("Reminder sequence not found");
  return sequence;
}

export async function createSequence(
  organizationId: string,
  userId: string,
  input: CreateReminderSequenceInput,
) {
  const sequence = await remindersRepository.createSequenceWithSteps(organizationId, input);
  await recordAuditLog({
    organizationId,
    userId,
    action: "reminder_sequence.created",
    entityType: "ReminderSequence",
    entityId: sequence.id,
  });
  return sequence;
}

export async function updateSequence(
  organizationId: string,
  userId: string,
  id: string,
  input: UpdateReminderSequenceInput,
) {
  const { count } = await remindersRepository.updateSequence(organizationId, id, input);
  if (count === 0) throw new NotFoundError("Reminder sequence not found");

  await recordAuditLog({
    organizationId,
    userId,
    action: "reminder_sequence.updated",
    entityType: "ReminderSequence",
    entityId: id,
    metadata: input,
  });
  return remindersRepository.findSequenceById(organizationId, id);
}

export async function deleteSequence(organizationId: string, userId: string, id: string) {
  const existing = await remindersRepository.findSequenceById(organizationId, id);
  if (!existing) throw new NotFoundError("Reminder sequence not found");

  const invoiceCount = await remindersRepository.countInvoicesUsingSequence(organizationId, id);
  if (invoiceCount > 0) {
    throw new ConflictError(
      "This reminder sequence is attached to invoices and cannot be deleted. Deactivate it instead.",
    );
  }

  await remindersRepository.deleteSequence(organizationId, id);
  await recordAuditLog({
    organizationId,
    userId,
    action: "reminder_sequence.deleted",
    entityType: "ReminderSequence",
    entityId: id,
  });
}

export async function updateStep(
  organizationId: string,
  userId: string,
  sequenceId: string,
  stepId: string,
  input: UpdateReminderStepInput,
) {
  const step = await remindersRepository.findStepById(organizationId, sequenceId, stepId);
  if (!step) throw new NotFoundError("Reminder step not found");

  const updated = await remindersRepository.updateStepAndTemplate(stepId, step.emailTemplateId, input);
  await recordAuditLog({
    organizationId,
    userId,
    action: "reminder_step.updated",
    entityType: "ReminderStep",
    entityId: stepId,
    metadata: input,
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Scheduling engine — called from invoices.service on create/update/resume
// ---------------------------------------------------------------------------

/**
 * Inserts (or refreshes) one PENDING ReminderEvent per step in the invoice's
 * reminder sequence. Safe to call repeatedly — events that already sent or
 * are otherwise past PENDING are left untouched (see upsertPendingEvent).
 */
export async function scheduleRemindersForInvoice(params: {
  organizationId: string;
  invoiceId: string;
  reminderSequenceId: string;
  dueDate: Date;
  organizationTimezone: string;
}): Promise<void> {
  const sequence = await remindersRepository.findActiveSequenceById(
    params.organizationId,
    params.reminderSequenceId,
  );
  if (!sequence) {
    throw new ValidationError("Reminder sequence not found or is not active");
  }

  const dueDateCalendar = toCalendarDate(params.dueDate);

  for (const step of sequence.steps) {
    const scheduledAt = orgLocalMidnightUtc(
      addCalendarDays(dueDateCalendar, step.delayDays),
      params.organizationTimezone,
    );
    await remindersRepository.upsertPendingEvent({
      organizationId: params.organizationId,
      invoiceId: params.invoiceId,
      reminderStepId: step.id,
      scheduledAt,
    });
  }
}

export async function cancelRemindersForInvoice(organizationId: string, invoiceId: string) {
  await remindersRepository.cancelPendingEventsForInvoice(organizationId, invoiceId);
}

/** business rule: resuming paused reminders must not silently drop reminders that lapsed while paused. */
export async function realignRemindersAfterResume(organizationId: string, invoiceId: string) {
  await remindersRepository.pullLapsedPendingEventsToNow(organizationId, invoiceId, new Date());
}

export async function listEventsForInvoice(organizationId: string, invoiceId: string) {
  return remindersRepository.findEventsForInvoice(organizationId, invoiceId);
}
