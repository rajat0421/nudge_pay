import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { authHeader, createTestApp, registerTestUser } from "./helpers/app";

describe("invoices", () => {
  let app: FastifyInstance;
  let token: ReturnType<typeof authHeader>;
  let clientId: string;
  let sequenceId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { body } = await registerTestUser(app, { email: "invoices@test.com" });
    token = authHeader(body.data.tokens.accessToken);

    const client = await app.inject({
      method: "POST",
      url: "/api/v1/clients",
      headers: token,
      payload: { name: "Test Client", email: "client@test.com" },
    });
    clientId = client.json().data.id;

    const sequence = await app.inject({
      method: "POST",
      url: "/api/v1/reminder-sequences",
      headers: token,
      payload: {
        name: "Test sequence",
        steps: [
          { delayDays: 2, subject: "Nudge {{invoice_number}}", body: "Hi {{client_name}}, pay {{amount}}." },
          { delayDays: 7, subject: "Second nudge", body: "Still waiting on {{invoice_number}}." },
        ],
      },
    });
    sequenceId = sequence.json().data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function futureDate(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  it("creates a draft invoice without a reminder sequence", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: token,
      payload: {
        clientId,
        invoiceNumber: "INV-2001",
        amount: 1200.5,
        currency: "USD",
        issueDate: futureDate(0),
        dueDate: futureDate(30),
      },
    });

    expect(response.statusCode).toBe(201);
    const invoice = response.json().data;
    expect(invoice.status).toBe("DRAFT");
    expect(invoice.amount).toBe(1200.5);
  });

  it("activates an invoice and schedules reminder events when a sequence is attached", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: token,
      payload: {
        clientId,
        invoiceNumber: "INV-2002",
        amount: 500,
        currency: "USD",
        issueDate: futureDate(0),
        dueDate: futureDate(30),
        reminderSequenceId: sequenceId,
      },
    });

    expect(response.statusCode).toBe(201);
    const invoice = response.json().data;
    expect(invoice.status).toBe("SENT");

    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/invoices/${invoice.id}`,
      headers: token,
    });
    expect(detail.json().data.reminderEvents).toHaveLength(2);
    expect(detail.json().data.reminderEvents.every((e: { status: string }) => e.status === "PENDING")).toBe(
      true,
    );
  });

  it("updates an invoice's amount", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: token,
      payload: {
        clientId,
        invoiceNumber: "INV-2003",
        amount: 100,
        currency: "USD",
        issueDate: futureDate(0),
        dueDate: futureDate(30),
      },
    });
    const invoiceId = created.json().data.id;

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/v1/invoices/${invoiceId}`,
      headers: token,
      payload: { amount: 250.75 },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.amount).toBe(250.75);
  });

  it("marks an invoice paid and cancels its pending reminders", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: token,
      payload: {
        clientId,
        invoiceNumber: "INV-2004",
        amount: 300,
        currency: "USD",
        issueDate: futureDate(0),
        dueDate: futureDate(30),
        reminderSequenceId: sequenceId,
      },
    });
    const invoiceId = created.json().data.id;

    const paid = await app.inject({
      method: "POST",
      url: `/api/v1/invoices/${invoiceId}/mark-paid`,
      headers: token,
    });

    expect(paid.statusCode).toBe(200);
    const invoice = paid.json().data;
    expect(invoice.status).toBe("PAID");
    expect(invoice.paidAt).toBeTruthy();
    expect(invoice.reminderEvents.every((e: { status: string }) => e.status !== "PENDING")).toBe(true);
  });

  it("rejects modifying a paid invoice", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: token,
      payload: {
        clientId,
        invoiceNumber: "INV-2005",
        amount: 300,
        currency: "USD",
        issueDate: futureDate(0),
        dueDate: futureDate(30),
      },
    });
    const invoiceId = created.json().data.id;
    await app.inject({ method: "POST", url: `/api/v1/invoices/${invoiceId}/mark-paid`, headers: token });

    const update = await app.inject({
      method: "PATCH",
      url: `/api/v1/invoices/${invoiceId}`,
      headers: token,
      payload: { amount: 999 },
    });

    expect(update.statusCode).toBe(409);
  });

  it("cancels an invoice via PATCH status=CANCELLED and cancels its reminders", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: token,
      payload: {
        clientId,
        invoiceNumber: "INV-2006",
        amount: 300,
        currency: "USD",
        issueDate: futureDate(0),
        dueDate: futureDate(30),
        reminderSequenceId: sequenceId,
      },
    });
    const invoiceId = created.json().data.id;

    const cancelled = await app.inject({
      method: "PATCH",
      url: `/api/v1/invoices/${invoiceId}`,
      headers: token,
      payload: { status: "CANCELLED" },
    });

    expect(cancelled.json().data.status).toBe("CANCELLED");
    expect(cancelled.json().data.reminderEvents.every((e: { status: string }) => e.status !== "PENDING")).toBe(
      true,
    );
  });

  it("pauses and resumes reminders", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: token,
      payload: {
        clientId,
        invoiceNumber: "INV-2007",
        amount: 300,
        currency: "USD",
        issueDate: futureDate(0),
        dueDate: futureDate(30),
        reminderSequenceId: sequenceId,
      },
    });
    const invoiceId = created.json().data.id;

    const paused = await app.inject({
      method: "POST",
      url: `/api/v1/invoices/${invoiceId}/pause-reminders`,
      headers: token,
    });
    expect(paused.json().data.remindersPaused).toBe(true);

    const resumed = await app.inject({
      method: "POST",
      url: `/api/v1/invoices/${invoiceId}/resume-reminders`,
      headers: token,
    });
    expect(resumed.json().data.remindersPaused).toBe(false);
  });

  it("only allows deleting draft invoices", async () => {
    const draft = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: token,
      payload: {
        clientId,
        invoiceNumber: "INV-2008",
        amount: 300,
        currency: "USD",
        issueDate: futureDate(0),
        dueDate: futureDate(30),
      },
    });
    const draftId = draft.json().data.id;
    const deleteDraft = await app.inject({
      method: "DELETE",
      url: `/api/v1/invoices/${draftId}`,
      headers: token,
    });
    expect(deleteDraft.statusCode).toBe(204);

    const active = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: token,
      payload: {
        clientId,
        invoiceNumber: "INV-2009",
        amount: 300,
        currency: "USD",
        issueDate: futureDate(0),
        dueDate: futureDate(30),
        reminderSequenceId: sequenceId,
      },
    });
    const activeId = active.json().data.id;
    const deleteActive = await app.inject({
      method: "DELETE",
      url: `/api/v1/invoices/${activeId}`,
      headers: token,
    });
    expect(deleteActive.statusCode).toBe(409);
  });
});
