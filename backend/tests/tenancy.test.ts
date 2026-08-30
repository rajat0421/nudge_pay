import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { authHeader, createTestApp, registerTestUser } from "./helpers/app";

describe("multi-tenancy isolation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("prevents a user from reading another organization's client, even by exact UUID", async () => {
    const orgA = await registerTestUser(app, { email: "orga-owner@test.com" });
    const orgB = await registerTestUser(app, { email: "orgb-owner@test.com" });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/clients",
      headers: authHeader(orgA.body.data.tokens.accessToken),
      payload: { name: "Org A's Client", email: "client@orga.test" },
    });
    const clientId = createResponse.json().data.id;

    const crossOrgResponse = await app.inject({
      method: "GET",
      url: `/api/v1/clients/${clientId}`,
      headers: authHeader(orgB.body.data.tokens.accessToken),
    });

    expect(crossOrgResponse.statusCode).toBe(404);

    const sameOrgResponse = await app.inject({
      method: "GET",
      url: `/api/v1/clients/${clientId}`,
      headers: authHeader(orgA.body.data.tokens.accessToken),
    });
    expect(sameOrgResponse.statusCode).toBe(200);
  });

  it("prevents a user from reading or mutating another organization's invoice", async () => {
    const orgA = await registerTestUser(app, { email: "orga-inv@test.com" });
    const orgB = await registerTestUser(app, { email: "orgb-inv@test.com" });
    const tokenA = authHeader(orgA.body.data.tokens.accessToken);
    const tokenB = authHeader(orgB.body.data.tokens.accessToken);

    const client = await app.inject({
      method: "POST",
      url: "/api/v1/clients",
      headers: tokenA,
      payload: { name: "Client", email: "c@orga.test" },
    });
    const clientId = client.json().data.id;

    const invoice = await app.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: tokenA,
      payload: {
        clientId,
        invoiceNumber: "INV-A-1",
        amount: 500,
        currency: "USD",
        issueDate: "2026-01-01",
        dueDate: "2026-02-01",
      },
    });
    const invoiceId = invoice.json().data.id;

    const readAsB = await app.inject({
      method: "GET",
      url: `/api/v1/invoices/${invoiceId}`,
      headers: tokenB,
    });
    expect(readAsB.statusCode).toBe(404);

    const markPaidAsB = await app.inject({
      method: "POST",
      url: `/api/v1/invoices/${invoiceId}/mark-paid`,
      headers: tokenB,
    });
    expect(markPaidAsB.statusCode).toBe(404);

    // The invoice must be untouched from org A's perspective.
    const readAsA = await app.inject({
      method: "GET",
      url: `/api/v1/invoices/${invoiceId}`,
      headers: tokenA,
    });
    expect(readAsA.json().data.status).not.toBe("PAID");
  });

  it("lists only the caller's own organization's clients", async () => {
    const orgA = await registerTestUser(app, { email: "orga-list@test.com" });
    const orgB = await registerTestUser(app, { email: "orgb-list@test.com" });

    await app.inject({
      method: "POST",
      url: "/api/v1/clients",
      headers: authHeader(orgA.body.data.tokens.accessToken),
      payload: { name: "A Client", email: "a@test.com" },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/clients",
      headers: authHeader(orgB.body.data.tokens.accessToken),
      payload: { name: "B Client", email: "b@test.com" },
    });

    const listAsA = await app.inject({
      method: "GET",
      url: "/api/v1/clients",
      headers: authHeader(orgA.body.data.tokens.accessToken),
    });

    const items = listAsA.json().data.items;
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("A Client");
  });
});
