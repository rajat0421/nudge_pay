import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { authHeader, createTestApp, registerTestUser } from "./helpers/app";

describe("dashboard", () => {
  let app: FastifyInstance;
  let token: ReturnType<typeof authHeader>;
  let clientId: string;
  let sequenceId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { body } = await registerTestUser(app, { email: "dashboard@test.com" });
    token = authHeader(body.data.tokens.accessToken);

    const client = await app.inject({
      method: "POST",
      url: "/api/v1/clients",
      headers: token,
      payload: { name: "Dashboard Client", email: "dashclient@test.com" },
    });
    clientId = client.json().data.id;

    const sequence = await app.inject({
      method: "POST",
      url: "/api/v1/reminder-sequences",
      headers: token,
      payload: {
        name: "Dashboard test sequence",
        steps: [{ delayDays: 2, subject: "Nudge", body: "Pay {{amount}}." }],
      },
    });
    sequenceId = sequence.json().data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function isoDaysFromNow(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async function createInvoice(invoiceNumber: string, amount: number, dueInDays: number) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: token,
      payload: {
        clientId,
        invoiceNumber,
        amount,
        currency: "USD",
        issueDate: isoDaysFromNow(-10),
        dueDate: isoDaysFromNow(dueInDays),
        reminderSequenceId: sequenceId,
      },
    });
    return response.json().data;
  }

  it("aggregates outstanding, overdue and paid totals correctly", async () => {
    await createInvoice("INV-4001", 500, -5);
    await createInvoice("INV-4002", 300, 20);
    const toBePaid = await createInvoice("INV-4003", 200, 20);

    await app.inject({
      method: "POST",
      url: `/api/v1/invoices/${toBePaid.id}/mark-paid`,
      headers: token,
    });

    const summary = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/summary",
      headers: token,
    });

    expect(summary.statusCode).toBe(200);
    const data = summary.json().data;

    // Outstanding = anything not draft/paid/cancelled = overdue (500) + the
    // still-open invoice (300) created above, minus whatever this org may
    // already carry from other tests sharing the truncated table (none —
    // each test file gets a fresh org via registerTestUser).
    expect(data.overdueAmount).toBe(500);
    expect(data.overdueCount).toBe(1);
    expect(data.paidThisMonth).toBeGreaterThanOrEqual(200);
    expect(data.outstandingAmount).toBeGreaterThanOrEqual(800);
    expect(data.totalInvoices).toBe(3);
  });

  it("lists overdue invoices with pagination", async () => {
    await createInvoice("INV-4004", 111, -2);
    await createInvoice("INV-4005", 222, -3);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/overdue?page=1&limit=1",
      headers: token,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.items).toHaveLength(1);
    expect(body.pagination.limit).toBe(1);
    expect(body.pagination.total).toBeGreaterThanOrEqual(2);
  });
});
