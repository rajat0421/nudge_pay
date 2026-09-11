import { supabase, unwrap, unwrapVoid, type Row } from "../../db/supabase";
import {
  mapReminderEvent,
  mapReminderEventWithStep,
  mapReminderSequenceWithSteps,
  mapReminderStepWithTemplate,
  type ReminderEventRow,
  type ReminderSequenceRow,
  type ReminderStepRow,
  type EmailTemplateRow,
} from "../../db/mappers";
import type { CreateReminderSequenceInput } from "./reminders.schemas";

const SEQUENCE_WITH_STEPS_SELECT = "*, steps:reminder_steps(*, emailTemplate:email_templates(*))";

type SequenceWithSteps = ReminderSequenceRow & {
  steps: Array<ReminderStepRow & { emailTemplate: EmailTemplateRow }>;
};

// ---------------------------------------------------------------------------
// Reminder sequences, steps & templates
// ---------------------------------------------------------------------------

export async function listSequences(organizationId: string): Promise<SequenceWithSteps[]> {
  const rows = unwrap<Row[]>(
    await supabase
      .from("reminder_sequences")
      .select(SEQUENCE_WITH_STEPS_SELECT)
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false }),
  );
  return (rows ?? []).map(mapReminderSequenceWithSteps);
}

export async function findSequenceById(
  organizationId: string,
  id: string,
): Promise<SequenceWithSteps | null> {
  const row = unwrap<Row | null>(
    await supabase
      .from("reminder_sequences")
      .select(SEQUENCE_WITH_STEPS_SELECT)
      .eq("id", id)
      .eq("organizationId", organizationId)
      .maybeSingle(),
  );
  return row && mapReminderSequenceWithSteps(row);
}

/** Used internally by the scheduling engine — only returns active sequences. */
export async function findActiveSequenceById(
  organizationId: string,
  id: string,
): Promise<SequenceWithSteps | null> {
  const row = unwrap<Row | null>(
    await supabase
      .from("reminder_sequences")
      .select(SEQUENCE_WITH_STEPS_SELECT)
      .eq("id", id)
      .eq("organizationId", organizationId)
      .eq("isActive", true)
      .maybeSingle(),
  );
  return row && mapReminderSequenceWithSteps(row);
}

export async function createSequenceWithSteps(
  organizationId: string,
  input: CreateReminderSequenceInput,
): Promise<SequenceWithSteps> {
  const sequenceId = unwrap<string>(
    await supabase.rpc("create_reminder_sequence_with_steps", {
      p_organization_id: organizationId,
      p_name: input.name,
      p_description: input.description ?? null,
      p_is_active: input.isActive,
      p_steps: input.steps,
    }),
  );

  const created = await findSequenceById(organizationId, sequenceId);
  if (!created) throw new Error("Failed to load reminder sequence after creation");
  return created;
}

export interface UpdateSequenceData {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export async function updateSequence(
  organizationId: string,
  id: string,
  data: UpdateSequenceData,
): Promise<{ count: number }> {
  const rows = unwrap<Row[]>(
    await supabase
      .from("reminder_sequences")
      .update(data)
      .eq("id", id)
      .eq("organizationId", organizationId)
      .select("id"),
  );
  return { count: rows?.length ?? 0 };
}

export async function deleteSequence(organizationId: string, id: string): Promise<{ count: number }> {
  const rows = unwrap<Row[]>(
    await supabase
      .from("reminder_sequences")
      .delete()
      .eq("id", id)
      .eq("organizationId", organizationId)
      .select("id"),
  );
  return { count: rows?.length ?? 0 };
}

export async function countInvoicesUsingSequence(
  organizationId: string,
  sequenceId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("organizationId", organizationId)
    .eq("reminderSequenceId", sequenceId);
  if (error) throw error;
  return count ?? 0;
}

export async function findStepById(
  organizationId: string,
  sequenceId: string,
  stepId: string,
): Promise<(ReminderStepRow & { emailTemplate: EmailTemplateRow }) | null> {
  const row = unwrap<Row | null>(
    await supabase
      .from("reminder_steps")
      .select("*, emailTemplate:email_templates(*), reminderSequence:reminder_sequences!inner(organizationId)")
      .eq("id", stepId)
      .eq("reminderSequenceId", sequenceId)
      .eq("reminderSequence.organizationId", organizationId)
      .maybeSingle(),
  );
  return row && mapReminderStepWithTemplate(row);
}

export async function updateStepAndTemplate(
  stepId: string,
  emailTemplateId: string,
  data: { delayDays?: number; subject?: string; body?: string },
): Promise<ReminderStepRow & { emailTemplate: EmailTemplateRow }> {
  unwrapVoid(
    await supabase.rpc("update_reminder_step_and_template", {
      p_step_id: stepId,
      p_email_template_id: emailTemplateId,
      p_delay_days: data.delayDays ?? null,
      p_subject: data.subject ?? null,
      p_body: data.body ?? null,
    }),
  );

  const row = unwrap<Row>(
    await supabase
      .from("reminder_steps")
      .select("*, emailTemplate:email_templates(*)")
      .eq("id", stepId)
      .single(),
  );
  return mapReminderStepWithTemplate(row);
}

// ---------------------------------------------------------------------------
// Reminder events — scheduling & the safe claim/send lifecycle
// ---------------------------------------------------------------------------

export async function upsertPendingEvent(params: {
  organizationId: string;
  invoiceId: string;
  reminderStepId: string;
  scheduledAt: Date;
}): Promise<ReminderEventRow> {
  const existing = unwrap<Row | null>(
    await supabase
      .from("reminder_events")
      .select("*")
      .eq("invoiceId", params.invoiceId)
      .eq("reminderStepId", params.reminderStepId)
      .maybeSingle(),
  );

  // Never resurrect or overwrite an event that already sent, is in-flight,
  // failed permanently, or was cancelled — only PENDING schedules can move.
  if (existing) {
    if (existing.status !== "PENDING") return mapReminderEvent(existing);
    const updated = unwrap<Row>(
      await supabase
        .from("reminder_events")
        .update({ scheduledAt: params.scheduledAt.toISOString() })
        .eq("id", existing.id as string)
        .select()
        .single(),
    );
    return mapReminderEvent(updated);
  }

  const created = unwrap<Row>(
    await supabase
      .from("reminder_events")
      .insert({
        organizationId: params.organizationId,
        invoiceId: params.invoiceId,
        reminderStepId: params.reminderStepId,
        scheduledAt: params.scheduledAt.toISOString(),
        status: "PENDING",
      })
      .select()
      .single(),
  );
  return mapReminderEvent(created);
}

export async function cancelPendingEventsForInvoice(
  organizationId: string,
  invoiceId: string,
): Promise<void> {
  unwrapVoid(
    await supabase
      .from("reminder_events")
      .update({ status: "CANCELLED" })
      .eq("organizationId", organizationId)
      .eq("invoiceId", invoiceId)
      .eq("status", "PENDING"),
  );
}

/** Any PENDING event whose scheduledAt lapsed while reminders were paused is pulled forward to now. */
export async function pullLapsedPendingEventsToNow(
  organizationId: string,
  invoiceId: string,
  now: Date,
): Promise<void> {
  unwrapVoid(
    await supabase
      .from("reminder_events")
      .update({ scheduledAt: now.toISOString() })
      .eq("organizationId", organizationId)
      .eq("invoiceId", invoiceId)
      .eq("status", "PENDING")
      .lt("scheduledAt", now.toISOString()),
  );
}

export async function findEventsForInvoice(
  organizationId: string,
  invoiceId: string,
): Promise<Array<ReminderEventRow & { reminderStep: ReminderStepRow }>> {
  const rows = unwrap<Row[]>(
    await supabase
      .from("reminder_events")
      .select("*, reminderStep:reminder_steps(*)")
      .eq("organizationId", organizationId)
      .eq("invoiceId", invoiceId)
      .order("scheduledAt", { ascending: true }),
  );
  return (rows ?? []).map(mapReminderEventWithStep);
}

export interface ClaimedReminderEvent extends ReminderEventRow {
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    dueDate: Date;
    paymentUrl: string | null;
    client: { name: string; email: string };
  };
  reminderStep: ReminderStepRow & { emailTemplate: EmailTemplateRow };
  organization: { id: string; name: string };
}

/**
 * Atomically claims up to `limit` due PENDING events using
 * `FOR UPDATE SKIP LOCKED` (inside the claim_due_reminder_events RPC) so
 * multiple worker processes (or overlapping ticks) can never claim the same
 * row — this is the entire race-condition defense, no Redis/queue required.
 */
export async function claimDueEvents(limit: number): Promise<ClaimedReminderEvent[]> {
  const claimed = unwrap<Array<{ id: string }>>(
    await supabase.rpc("claim_due_reminder_events", { p_limit: limit }),
  );
  const ids = (claimed ?? []).map((row) => row.id);
  if (ids.length === 0) return [];

  const rows = unwrap<Row[]>(
    await supabase
      .from("reminder_events")
      .select(
        `*,
         invoice:invoices(id, invoiceNumber, amount, currency, dueDate, paymentUrl, client:clients(name, email)),
         reminderStep:reminder_steps(*, emailTemplate:email_templates(*)),
         organization:organizations(id, name)`,
      )
      .in("id", ids),
  );

  return (rows ?? []).map((row) => {
    const invoice = row.invoice as Row;
    return {
      ...mapReminderEvent(row),
      invoice: { ...invoice, dueDate: new Date(invoice.dueDate as string) },
      reminderStep: mapReminderStepWithTemplate(row.reminderStep as Row),
      organization: row.organization,
    };
  }) as ClaimedReminderEvent[];
}

export async function markEventSent(
  eventId: string,
  providerMessageId: string | undefined,
): Promise<void> {
  unwrapVoid(
    await supabase
      .from("reminder_events")
      .update({
        status: "SENT",
        sentAt: new Date().toISOString(),
        providerMessageId: providerMessageId ?? null,
        lastError: null,
      })
      .eq("id", eventId),
  );
}

export async function markEventCancelled(eventId: string): Promise<void> {
  unwrapVoid(await supabase.from("reminder_events").update({ status: "CANCELLED" }).eq("id", eventId));
}

export async function markEventRetry(
  eventId: string,
  attempts: number,
  nextAttemptAt: Date,
  error: string,
): Promise<void> {
  unwrapVoid(
    await supabase
      .from("reminder_events")
      .update({
        status: "PENDING",
        attempts,
        scheduledAt: nextAttemptAt.toISOString(),
        lastError: error.slice(0, 1000),
      })
      .eq("id", eventId),
  );
}

export async function markEventFailedPermanently(
  eventId: string,
  attempts: number,
  error: string,
): Promise<void> {
  unwrapVoid(
    await supabase
      .from("reminder_events")
      .update({ status: "FAILED", attempts, lastError: error.slice(0, 1000) })
      .eq("id", eventId),
  );
}

/** Crash recovery: events stuck in PROCESSING for too long are handed back to the queue. */
export async function recoverStuckProcessingEvents(olderThan: Date): Promise<{ count: number }> {
  const count = unwrap<number>(
    await supabase.rpc("recover_stuck_processing_events", { p_older_than: olderThan.toISOString() }),
  );
  return { count: count ?? 0 };
}
