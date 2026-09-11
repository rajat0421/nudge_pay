import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { supabase } from "../src/db/supabase";
import { mapReminderEvent, type ReminderEventRow } from "../src/db/mappers";
import { setEmailProvider } from "../src/modules/email/email.service";
import type { EmailProvider } from "../src/modules/email/email.types";
import { runReminderWorker } from "../src/jobs/reminder-worker";
import { computeTimeBasedStatus } from "../src/modules/invoices/invoices.status";
import { authHeader, createTestApp, registerTestUser } from "./helpers/app";

class FakeEmailProvider implements EmailProvider {
  public sent: Array<{ to: string; subject: string }> = [];
  public shouldFail = false;

  async send(params: { to: string; subject: string }) {
    if (this.shouldFail) {
      throw new Error("simulated provider failure");
    }
    this.sent.push({ to: params.to, subject: params.subject });
    return { providerMessageId: `fake-${this.sent.length}` };
  }
}

async function findReminderEvents(invoiceId: string): Promise<ReminderEventRow[]> {
  const { data, error } = await supabase.from("reminder_events").select("*").eq("invoiceId", invoiceId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapReminderEvent);
}

async function findReminderEvent(id: string): Promise<ReminderEventRow> {
  const { data, error } = await supabase.from("reminder_events").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return mapReminderEvent(data);
}

async function updateReminderEvent(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("reminder_events").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

describe("reminder engine", () => {
  let app: FastifyInstance;
  let token: ReturnType<typeof authHeader>;
  let clientId: string;
  let sequenceId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { body } = await registerTestUser(app, { email: "reminders@test.com" });
    token = authHeader(body.data.tokens.accessToken);

    const client = await app.inject({
      method: "POST",
      url: "/api/v1/clients",
      headers: token,
      payload: { name: "Reminder Client", email: "remindclient@test.com" },
    });
    clientId = client.json().data.id;

    const sequence = await app.inject({
      method: "POST",
      url: "/api/v1/reminder-sequences",
      headers: token,
      payload: {
        name: "Engine test sequence",
        steps: [
          { delayDays: 2, subject: "Step 1 — {{invoice_number}}", body: "Pay {{amount}} by {{due_date}}." },
          { delayDays: 7, subject: "Step 2", body: "Still waiting." },
        ],
      },
    });
    sequenceId = sequence.json().data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    setEmailProvider(new FakeEmailProvider());
  });

  function isoDaysFromNow(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async function createActiveInvoice(invoiceNumber: string, dueInDays: number) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: token,
      payload: {
        clientId,
        invoiceNumber,
        amount: 100,
        currency: "USD",
        issueDate: isoDaysFromNow(0),
        dueDate: isoDaysFromNow(dueInDays),
        reminderSequenceId: sequenceId,
      },
    });
    return response.json().data;
  }

  it("computes OVERDUE only once the due date has fully passed in the org timezone", () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 2);

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 10);

    expect(computeTimeBasedStatus(yesterday, "UTC")).toBe("OVERDUE");
    expect(computeTimeBasedStatus(tomorrow, "UTC")).toBe("SENT");
  });

  it("schedules one reminder event per step, and never duplicates them", async () => {
    const invoice = await createActiveInvoice("INV-3001", 30);
    const events = await findReminderEvents(invoice.id);
    expect(events).toHaveLength(2);

    // Changing the due date re-triggers scheduling for the same invoice —
    // this must update the existing two rows in place (unique
    // (invoiceId, reminderStepId) constraint + upsert), never add duplicates.
    const detail = await app.inject({
      method: "PATCH",
      url: `/api/v1/invoices/${invoice.id}`,
      headers: token,
      payload: { dueDate: isoDaysFromNow(45) },
    });
    expect(detail.statusCode).toBe(200);

    const eventsAfter = await findReminderEvents(invoice.id);
    expect(eventsAfter).toHaveLength(2);
    expect(eventsAfter.every((e) => e.scheduledAt.getTime() > events[0]!.scheduledAt.getTime())).toBe(
      true,
    );
  });

  it("dispatches a due reminder and never sends it twice", async () => {
    const fake = new FakeEmailProvider();
    setEmailProvider(fake);

    const invoice = await createActiveInvoice("INV-3002", 30);
    // Force the first step's event into the past so the worker picks it up now.
    const events = (await findReminderEvents(invoice.id)).sort(
      (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
    );
    await updateReminderEvent(events[0]!.id, { scheduledAt: new Date(Date.now() - 60_000).toISOString() });

    const result = await runReminderWorker();
    expect(result.sent).toBe(1);
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]!.to).toBe("remindclient@test.com");

    const sentEvent = await findReminderEvent(events[0]!.id);
    expect(sentEvent.status).toBe("SENT");
    expect(sentEvent.sentAt).toBeTruthy();

    // A second tick must not re-send the same event.
    const secondResult = await runReminderWorker();
    expect(secondResult.processed).toBe(0);
    expect(fake.sent).toHaveLength(1);
  });

  it("retries a failed send with backoff and eventually marks it FAILED", async () => {
    const fake = new FakeEmailProvider();
    fake.shouldFail = true;
    setEmailProvider(fake);

    const invoice = await createActiveInvoice("INV-3003", 30);
    const events = (await findReminderEvents(invoice.id)).sort(
      (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
    );
    const eventId = events[0]!.id;
    await updateReminderEvent(eventId, { scheduledAt: new Date(Date.now() - 60_000).toISOString() });

    await runReminderWorker();
    let event = await findReminderEvent(eventId);
    expect(event.status).toBe("PENDING");
    expect(event.attempts).toBe(1);
    expect(event.scheduledAt.getTime()).toBeGreaterThan(Date.now());
    expect(event.lastError).toContain("simulated provider failure");

    // Simulate time passing so the backed-off event is due again, repeatedly,
    // until MAX_EMAIL_RETRIES is exceeded and it's marked FAILED for good.
    for (let i = 0; i < 5; i++) {
      await updateReminderEvent(eventId, { scheduledAt: new Date(Date.now() - 1000).toISOString() });
      await runReminderWorker();
      event = await findReminderEvent(eventId);
      if (event.status === "FAILED") break;
    }

    expect(event.status).toBe("FAILED");
    expect(fake.sent).toHaveLength(0);
  });

  it("never sends a reminder for a paid invoice", async () => {
    const fake = new FakeEmailProvider();
    setEmailProvider(fake);

    const invoice = await createActiveInvoice("INV-3004", 30);
    await app.inject({ method: "POST", url: `/api/v1/invoices/${invoice.id}/mark-paid`, headers: token });

    const events = await findReminderEvents(invoice.id);
    expect(events.every((e) => e.status === "CANCELLED")).toBe(true);

    await runReminderWorker();
    expect(fake.sent).toHaveLength(0);
  });

  it("never sends a reminder while an invoice's reminders are paused", async () => {
    const fake = new FakeEmailProvider();
    setEmailProvider(fake);

    const invoice = await createActiveInvoice("INV-3005", 30);
    await app.inject({
      method: "POST",
      url: `/api/v1/invoices/${invoice.id}/pause-reminders`,
      headers: token,
    });

    const events = await findReminderEvents(invoice.id);
    await updateReminderEvent(events[0]!.id, { scheduledAt: new Date(Date.now() - 60_000).toISOString() });

    const result = await runReminderWorker();
    expect(result.skipped).toBe(1);
    expect(fake.sent).toHaveLength(0);

    const skippedEvent = await findReminderEvent(events[0]!.id);
    expect(skippedEvent.status).toBe("CANCELLED");
  });

  it("pulls lapsed reminders forward to fire promptly after resuming", async () => {
    const invoice = await createActiveInvoice("INV-3006", 30);
    await app.inject({
      method: "POST",
      url: `/api/v1/invoices/${invoice.id}/pause-reminders`,
      headers: token,
    });

    const events = await findReminderEvents(invoice.id);
    const lapsedAt = new Date(Date.now() - 3600_000);
    await updateReminderEvent(events[0]!.id, { scheduledAt: lapsedAt.toISOString() });

    await app.inject({
      method: "POST",
      url: `/api/v1/invoices/${invoice.id}/resume-reminders`,
      headers: token,
    });

    const realigned = await findReminderEvent(events[0]!.id);
    expect(realigned.scheduledAt.getTime()).toBeGreaterThan(lapsedAt.getTime());
    expect(realigned.status).toBe("PENDING");
  });
});
