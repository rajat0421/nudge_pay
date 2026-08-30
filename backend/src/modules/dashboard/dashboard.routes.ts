import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { paginatedEnvelope, successEnvelope } from "../../utils/openapi";
import { dashboardListQuerySchema } from "./dashboard.schemas";
import { getActivityHandler, getOverdueHandler, getSummaryHandler } from "./dashboard.controller";

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/summary",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Outstanding/overdue/paid totals, invoice counts and upcoming due invoices",
        security: [{ bearerAuth: [] }],
        response: { 200: successEnvelope(z.any()) },
      },
    },
    getSummaryHandler,
  );

  app.get(
    "/overdue",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Paginated list of overdue invoices",
        security: [{ bearerAuth: [] }],
        querystring: dashboardListQuerySchema,
        response: { 200: paginatedEnvelope(z.any()) },
      },
    },
    getOverdueHandler,
  );

  app.get(
    "/activity",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Paginated recent reminder activity (sent/failed)",
        security: [{ bearerAuth: [] }],
        querystring: dashboardListQuerySchema,
        response: { 200: paginatedEnvelope(z.any()) },
      },
    },
    getActivityHandler,
  );
}
