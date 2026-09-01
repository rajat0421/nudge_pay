import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { successEnvelope } from "../../utils/openapi";
import { updateOrganizationSchema } from "./organizations.schemas";
import { getMyOrganizationHandler, updateMyOrganizationHandler } from "./organizations.controller";

export async function organizationsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/me",
    {
      schema: {
        tags: ["Organizations"],
        summary: "Get the current user's organization",
        security: [{ bearerAuth: [] }],
        response: { 200: successEnvelope(z.any()) },
      },
    },
    getMyOrganizationHandler,
  );

  app.patch(
    "/me",
    {
      schema: {
        tags: ["Organizations"],
        summary: "Update the current user's organization (name, timezone, currency)",
        security: [{ bearerAuth: [] }],
        body: updateOrganizationSchema,
        response: { 200: successEnvelope(z.any()) },
      },
    },
    updateMyOrganizationHandler,
  );
}
