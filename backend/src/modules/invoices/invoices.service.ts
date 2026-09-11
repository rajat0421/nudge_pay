import { ConflictError, NotFoundError, ValidationError } from "../../utils/errors";
import { majorToMinorUnits, minorToMajorUnits } from "../../utils/money";
import { toCalendarDate } from "../../utils/dates";
import { paginate, toSkipTake, type PaginationQuery } from "../../utils/pagination";
import { recordAuditLog } from "../audit/audit.service";
import { getOrganizationById } from "../organizations/organizations.repository";
import * as remindersService from "../reminders/reminders.service";
import * as invoicesRepository from "./invoices.repository";
import { computeTimeBasedStatus, isTerminalStatus } from "./invoices.status";
import type { CreateInvoiceInput, ListInvoicesQuery, UpdateInvoiceInput } from "./invoices.schemas";

function toInvoiceDTO<T extends { amount: number }>(invoice: T) {
  return { ...invoice, amount: minorToMajorUnits(invoice.amount) };
}

async function requireOrganization(organizationId: string) {
  const organization = await getOrganizationById(organizationId);
  if (!organization) throw new NotFoundError("Organization not found");
  return organization;
}

export async function listInvoices(organizationId: string, query: ListInvoicesQuery) {
  const { skip, take } = toSkipTake(query as PaginationQuery);
  const [items, total] = await Promise.all([
    invoicesRepository.listInvoices(organizationId, { ...query, skip, take }),
    invoicesRepository.countInvoices(organizationId, query),
  ]);
  return paginate(items.map(toInvoiceDTO), total, query);
}

export async function getInvoice(organizationId: string, id: string) {
  const invoice = await invoicesRepository.findInvoiceById(organizationId, id);
  if (!invoice) throw new NotFoundError("Invoice not found");
  const reminderEvents = await remindersService.listEventsForInvoice(organizationId, id);
  return { ...toInvoiceDTO(invoice), reminderEvents };
}

export async function createInvoice(
  organizationId: string,
  userId: string,
  input: CreateInvoiceInput,
) {
  const organization = await requireOrganization(organizationId);

  const client = await invoicesRepository.findClientForOrg(organizationId, input.clientId);
  if (!client) throw new ValidationError("Client not found");

  const dueDate = toCalendarDate(input.dueDate);
  const issueDate = toCalendarDate(input.issueDate);
  const isActivated = Boolean(input.reminderSequenceId);
  const status = isActivated
    ? computeTimeBasedStatus(dueDate, organization.timezone)
    : ("DRAFT" as const);

  const invoice = await invoicesRepository.createInvoice(organizationId, {
    clientId: input.clientId,
    invoiceNumber: input.invoiceNumber,
    amount: majorToMinorUnits(input.amount),
    currency: input.currency,
    issueDate,
    dueDate,
    paymentUrl: input.paymentUrl || null,
    reminderSequenceId: input.reminderSequenceId ?? null,
    status,
  });

  if (input.reminderSequenceId) {
    // Reminders are scheduled now but never sent immediately — the worker
    // only acts once scheduledAt has actually elapsed.
    await remindersService.scheduleRemindersForInvoice({
      organizationId,
      invoiceId: invoice.id,
      reminderSequenceId: input.reminderSequenceId,
      dueDate,
      organizationTimezone: organization.timezone,
    });
  }

  await recordAuditLog({
    organizationId,
    userId,
    action: "invoice.created",
    entityType: "Invoice",
    entityId: invoice.id,
  });

  return toInvoiceDTO(invoice);
}

export async function updateInvoice(
  organizationId: string,
  userId: string,
  id: string,
  input: UpdateInvoiceInput,
) {
  const existing = await invoicesRepository.findInvoiceById(organizationId, id);
  if (!existing) throw new NotFoundError("Invoice not found");

  if (isTerminalStatus(existing.status)) {
    throw new ConflictError(`A ${existing.status.toLowerCase()} invoice cannot be modified`);
  }

  if (input.clientId) {
    const client = await invoicesRepository.findClientForOrg(organizationId, input.clientId);
    if (!client) throw new ValidationError("Client not found");
  }

  const organization = await requireOrganization(organizationId);
  const nextDueDate = input.dueDate ? toCalendarDate(input.dueDate) : existing.dueDate;
  const sequenceChanged =
    input.reminderSequenceId !== undefined && input.reminderSequenceId !== existing.reminderSequenceId;
  const dueDateChanged = input.dueDate !== undefined && nextDueDate.getTime() !== existing.dueDate.getTime();

  const nextReminderSequenceId =
    input.reminderSequenceId !== undefined ? input.reminderSequenceId : existing.reminderSequenceId;

  let nextStatus = existing.status;
  if (input.status === "CANCELLED") {
    nextStatus = "CANCELLED";
  } else if (nextReminderSequenceId && existing.status === "DRAFT") {
    // Attaching a sequence to a draft invoice activates it.
    nextStatus = computeTimeBasedStatus(nextDueDate, organization.timezone);
  } else if (!isTerminalStatus(existing.status) && existing.status !== "DRAFT") {
    nextStatus = computeTimeBasedStatus(nextDueDate, organization.timezone);
  }

  await invoicesRepository.updateInvoice(organizationId, id, {
    ...(input.clientId && { clientId: input.clientId }),
    ...(input.invoiceNumber && { invoiceNumber: input.invoiceNumber }),
    ...(input.amount !== undefined && { amount: majorToMinorUnits(input.amount) }),
    ...(input.currency && { currency: input.currency }),
    ...(input.issueDate && { issueDate: toCalendarDate(input.issueDate) }),
    ...(input.dueDate && { dueDate: nextDueDate }),
    ...(input.paymentUrl !== undefined && { paymentUrl: input.paymentUrl || null }),
    ...(input.reminderSequenceId !== undefined && { reminderSequenceId: input.reminderSequenceId }),
    status: nextStatus,
  });

  if (nextStatus === "CANCELLED") {
    await remindersService.cancelRemindersForInvoice(organizationId, id);
  } else if (nextReminderSequenceId && (sequenceChanged || dueDateChanged)) {
    if (sequenceChanged) {
      await remindersService.cancelRemindersForInvoice(organizationId, id);
    }
    await remindersService.scheduleRemindersForInvoice({
      organizationId,
      invoiceId: id,
      reminderSequenceId: nextReminderSequenceId,
      dueDate: nextDueDate,
      organizationTimezone: organization.timezone,
    });
  }

  await recordAuditLog({
    organizationId,
    userId,
    action: "invoice.updated",
    entityType: "Invoice",
    entityId: id,
    metadata: input,
  });

  return getInvoice(organizationId, id);
}

export async function deleteInvoice(organizationId: string, userId: string, id: string) {
  const existing = await invoicesRepository.findInvoiceById(organizationId, id);
  if (!existing) throw new NotFoundError("Invoice not found");
  if (existing.status !== "DRAFT") {
    throw new ConflictError("Only draft invoices can be deleted — cancel it instead");
  }

  await invoicesRepository.deleteInvoice(organizationId, id);
  await recordAuditLog({
    organizationId,
    userId,
    action: "invoice.deleted",
    entityType: "Invoice",
    entityId: id,
  });
}

export async function markPaid(organizationId: string, userId: string, id: string) {
  const existing = await invoicesRepository.findInvoiceById(organizationId, id);
  if (!existing) throw new NotFoundError("Invoice not found");
  if (existing.status === "CANCELLED") {
    throw new ConflictError("A cancelled invoice cannot be marked paid");
  }
  if (existing.status === "PAID") {
    return toInvoiceDTO(existing);
  }

  await invoicesRepository.updateInvoice(organizationId, id, {
    status: "PAID",
    paidAt: new Date(),
  });
  // Paid invoices never receive further reminders (business rule #1).
  await remindersService.cancelRemindersForInvoice(organizationId, id);

  await recordAuditLog({
    organizationId,
    userId,
    action: "invoice.marked_paid",
    entityType: "Invoice",
    entityId: id,
  });

  return getInvoice(organizationId, id);
}

export async function pauseReminders(organizationId: string, userId: string, id: string) {
  const existing = await invoicesRepository.findInvoiceById(organizationId, id);
  if (!existing) throw new NotFoundError("Invoice not found");
  if (isTerminalStatus(existing.status)) {
    throw new ConflictError(`A ${existing.status.toLowerCase()} invoice has no active reminders`);
  }

  await invoicesRepository.updateInvoice(organizationId, id, { remindersPaused: true });
  await recordAuditLog({
    organizationId,
    userId,
    action: "invoice.reminders_paused",
    entityType: "Invoice",
    entityId: id,
  });

  return getInvoice(organizationId, id);
}

export async function resumeReminders(organizationId: string, userId: string, id: string) {
  const existing = await invoicesRepository.findInvoiceById(organizationId, id);
  if (!existing) throw new NotFoundError("Invoice not found");
  if (isTerminalStatus(existing.status)) {
    throw new ConflictError(`A ${existing.status.toLowerCase()} invoice has no reminders to resume`);
  }

  await invoicesRepository.updateInvoice(organizationId, id, { remindersPaused: false });
  // Any reminder that lapsed while paused is pulled forward to fire on the next tick.
  await remindersService.realignRemindersAfterResume(organizationId, id);

  await recordAuditLog({
    organizationId,
    userId,
    action: "invoice.reminders_resumed",
    entityType: "Invoice",
    entityId: id,
  });

  return getInvoice(organizationId, id);
}
