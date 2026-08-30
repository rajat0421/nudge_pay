import { prisma } from "../../db/prisma";
import type { CreateReminderSequenceInput, UpdateReminderSequenceInput } from "./reminders.schemas";

// ---------------------------------------------------------------------------
// Reminder sequences, steps & templates
// ---------------------------------------------------------------------------

export function listSequences(organizationId: string) {
  return prisma.reminderSequence.findMany({
    where: { organizationId },
    include: { steps: { include: { emailTemplate: true }, orderBy: { stepOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export function findSequenceById(organizationId: string, id: string) {
  return prisma.reminderSequence.findFirst({
    where: { id, organizationId },
    include: { steps: { include: { emailTemplate: true }, orderBy: { stepOrder: "asc" } } },
  });
}

/** Used internally by the scheduling engine — only returns active sequences. */
export function findActiveSequenceById(organizationId: string, id: string) {
  return prisma.reminderSequence.findFirst({
    where: { id, organizationId, isActive: true },
    include: { steps: { include: { emailTemplate: true }, orderBy: { stepOrder: "asc" } } },
  });
}

export function createSequenceWithSteps(organizationId: string, input: CreateReminderSequenceInput) {
  return prisma.$transaction(async (tx) => {
    const sequence = await tx.reminderSequence.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        isActive: input.isActive,
      },
    });

    for (const [index, step] of input.steps.entries()) {
      const template = await tx.emailTemplate.create({
        data: {
          organizationId,
          name: `${input.name} — step ${index + 1}`,
          subject: step.subject,
          body: step.body,
        },
      });
      await tx.reminderStep.create({
        data: {
          reminderSequenceId: sequence.id,
          stepOrder: index + 1,
          delayDays: step.delayDays,
          emailTemplateId: template.id,
        },
      });
    }

    return tx.reminderSequence.findUniqueOrThrow({
      where: { id: sequence.id },
      include: { steps: { include: { emailTemplate: true }, orderBy: { stepOrder: "asc" } } },
    });
  });
}

export function updateSequence(
  organizationId: string,
  id: string,
  data: UpdateReminderSequenceInput,
) {
  return prisma.reminderSequence.updateMany({ where: { id, organizationId }, data });
}

export function deleteSequence(organizationId: string, id: string) {
  return prisma.reminderSequence.deleteMany({ where: { id, organizationId } });
}

export function countInvoicesUsingSequence(organizationId: string, sequenceId: string) {
  return prisma.invoice.count({ where: { organizationId, reminderSequenceId: sequenceId } });
}

export function findStepById(organizationId: string, sequenceId: string, stepId: string) {
  return prisma.reminderStep.findFirst({
    where: { id: stepId, reminderSequenceId: sequenceId, reminderSequence: { organizationId } },
    include: { emailTemplate: true },
  });
}

export function updateStepAndTemplate(
  stepId: string,
  emailTemplateId: string,
  data: { delayDays?: number; subject?: string; body?: string },
) {
  const { delayDays, ...templateData } = data;
  return prisma.$transaction(async (tx) => {
    if (delayDays !== undefined) {
      await tx.reminderStep.update({ where: { id: stepId }, data: { delayDays } });
    }
    if (templateData.subject !== undefined || templateData.body !== undefined) {
      await tx.emailTemplate.update({ where: { id: emailTemplateId }, data: templateData });
    }
    return tx.reminderStep.findUniqueOrThrow({
      where: { id: stepId },
      include: { emailTemplate: true },
    });
  });
}

// ---------------------------------------------------------------------------
// Reminder events — scheduling & the safe claim/send lifecycle
// ---------------------------------------------------------------------------

export async function upsertPendingEvent(params: {
  organizationId: string;
  invoiceId: string;
  reminderStepId: string;
  scheduledAt: Date;
}) {
  const existing = await prisma.reminderEvent.findUnique({
    where: {
      invoiceId_reminderStepId: {
        invoiceId: params.invoiceId,
        reminderStepId: params.reminderStepId,
      },
    },
  });

  // Never resurrect or overwrite an event that already sent, is in-flight,
  // failed permanently, or was cancelled — only PENDING schedules can move.
  if (existing) {
    if (existing.status !== "PENDING") return existing;
    return prisma.reminderEvent.update({
      where: { id: existing.id },
      data: { scheduledAt: params.scheduledAt },
    });
  }

  return prisma.reminderEvent.create({
    data: {
      organizationId: params.organizationId,
      invoiceId: params.invoiceId,
      reminderStepId: params.reminderStepId,
      scheduledAt: params.scheduledAt,
      status: "PENDING",
    },
  });
}

export function cancelPendingEventsForInvoice(organizationId: string, invoiceId: string) {
  return prisma.reminderEvent.updateMany({
    where: { organizationId, invoiceId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

/** Any PENDING event whose scheduledAt lapsed while reminders were paused is pulled forward to now. */
export function pullLapsedPendingEventsToNow(organizationId: string, invoiceId: string, now: Date) {
  return prisma.reminderEvent.updateMany({
    where: { organizationId, invoiceId, status: "PENDING", scheduledAt: { lt: now } },
    data: { scheduledAt: now },
  });
}

export function findEventsForInvoice(organizationId: string, invoiceId: string) {
  return prisma.reminderEvent.findMany({
    where: { organizationId, invoiceId },
    include: { reminderStep: true },
    orderBy: { scheduledAt: "asc" },
  });
}

/**
 * Atomically claims up to `limit` due PENDING events using
 * `FOR UPDATE SKIP LOCKED` so multiple worker processes (or overlapping
 * ticks) can never claim the same row — this is the entire race-condition
 * defense, no Redis/queue required.
 */
export async function claimDueEvents(limit: number) {
  return prisma.$transaction(async (tx) => {
    const due = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "reminder_events"
      WHERE status = 'PENDING' AND "scheduledAt" <= now()
      ORDER BY "scheduledAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    if (due.length === 0) return [];

    const ids = due.map((row) => row.id);
    await tx.reminderEvent.updateMany({
      where: { id: { in: ids } },
      data: { status: "PROCESSING" },
    });

    return tx.reminderEvent.findMany({
      where: { id: { in: ids } },
      include: {
        invoice: { include: { client: true } },
        reminderStep: { include: { emailTemplate: true } },
        organization: true,
      },
    });
  });
}

export function markEventSent(eventId: string, providerMessageId: string | undefined) {
  return prisma.reminderEvent.update({
    where: { id: eventId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      providerMessageId: providerMessageId ?? null,
      lastError: null,
    },
  });
}

export function markEventCancelled(eventId: string) {
  return prisma.reminderEvent.update({ where: { id: eventId }, data: { status: "CANCELLED" } });
}

export function markEventRetry(eventId: string, attempts: number, nextAttemptAt: Date, error: string) {
  return prisma.reminderEvent.update({
    where: { id: eventId },
    data: { status: "PENDING", attempts, scheduledAt: nextAttemptAt, lastError: error.slice(0, 1000) },
  });
}

export function markEventFailedPermanently(eventId: string, attempts: number, error: string) {
  return prisma.reminderEvent.update({
    where: { id: eventId },
    data: { status: "FAILED", attempts, lastError: error.slice(0, 1000) },
  });
}

/** Crash recovery: an event stuck in PROCESSING for too long is handed back to the queue. */
export function recoverStuckProcessingEvents(olderThan: Date) {
  return prisma.reminderEvent.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: olderThan } },
    data: { status: "PENDING" },
  });
}
