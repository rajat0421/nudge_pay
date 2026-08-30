import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { paginatedEnvelope, successEnvelope } from "../../utils/openapi";
import {
  createInvoiceSchema,
  invoiceIdParamsSchema,
  listInvoicesQuerySchema,
  updateInvoiceSchema,
} from "./invoices.schemas";
import {
  createInvoiceHandler,
  deleteInvoiceHandler,
  getInvoiceHandler,
  listInvoicesHandler,
  markPaidHandler,
  pauseRemindersHandler,
  resumeRemindersHandler,
  updateInvoiceHandler,
} from "./invoices.controller";

const invoiceSchema = z.any();

export async function invoicesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/",
    {
      schema: {
        tags: ["Invoices"],
        summary: "List invoices (paginated, filterable, sortable)",
        security: [{ bearerAuth: [] }],
        querystring: listInvoicesQuerySchema,
        response: { 200: paginatedEnvelope(invoiceSchema) },
      },
    },
    listInvoicesHandler,
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Invoices"],
        summary: "Create an invoice; attaching a reminder sequence activates it",
        security: [{ bearerAuth: [] }],
        body: createInvoiceSchema,
        response: { 201: successEnvelope(invoiceSchema) },
      },
    },
    createInvoiceHandler,
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Invoices"],
        summary: "Get an invoice with its reminder event timeline",
        security: [{ bearerAuth: [] }],
        params: invoiceIdParamsSchema,
        response: { 200: successEnvelope(invoiceSchema) },
      },
    },
    getInvoiceHandler,
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: ["Invoices"],
        summary: "Update an invoice (recalculates its reminder schedule if due date/sequence change)",
        security: [{ bearerAuth: [] }],
        params: invoiceIdParamsSchema,
        body: updateInvoiceSchema,
        response: { 200: successEnvelope(invoiceSchema) },
      },
    },
    updateInvoiceHandler,
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Invoices"],
        summary: "Delete a draft invoice",
        security: [{ bearerAuth: [] }],
        params: invoiceIdParamsSchema,
      },
    },
    deleteInvoiceHandler,
  );

  app.post(
    "/:id/mark-paid",
    {
      schema: {
        tags: ["Invoices"],
        summary: "Mark an invoice paid and stop its reminders",
        security: [{ bearerAuth: [] }],
        params: invoiceIdParamsSchema,
        response: { 200: successEnvelope(invoiceSchema) },
      },
    },
    markPaidHandler,
  );

  app.post(
    "/:id/pause-reminders",
    {
      schema: {
        tags: ["Invoices"],
        summary: "Pause reminders for an invoice",
        security: [{ bearerAuth: [] }],
        params: invoiceIdParamsSchema,
        response: { 200: successEnvelope(invoiceSchema) },
      },
    },
    pauseRemindersHandler,
  );

  app.post(
    "/:id/resume-reminders",
    {
      schema: {
        tags: ["Invoices"],
        summary: "Resume reminders for an invoice",
        security: [{ bearerAuth: [] }],
        params: invoiceIdParamsSchema,
        response: { 200: successEnvelope(invoiceSchema) },
      },
    },
    resumeRemindersHandler,
  );
}
