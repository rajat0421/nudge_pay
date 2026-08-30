import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { paginatedEnvelope, successEnvelope } from "../../utils/openapi";
import {
  createClientSchema,
  clientIdParamsSchema,
  listClientsQuerySchema,
  updateClientSchema,
} from "./clients.schemas";
import {
  createClientHandler,
  deleteClientHandler,
  getClientHandler,
  listClientsHandler,
  updateClientHandler,
} from "./clients.controller";

const clientSchema = z.any();

export async function clientsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/",
    {
      schema: {
        tags: ["Clients"],
        summary: "List clients (paginated, searchable, sortable)",
        security: [{ bearerAuth: [] }],
        querystring: listClientsQuerySchema,
        response: { 200: paginatedEnvelope(clientSchema) },
      },
    },
    listClientsHandler,
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Clients"],
        summary: "Create a client",
        security: [{ bearerAuth: [] }],
        body: createClientSchema,
        response: { 201: successEnvelope(clientSchema) },
      },
    },
    createClientHandler,
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Clients"],
        summary: "Get a client by id",
        security: [{ bearerAuth: [] }],
        params: clientIdParamsSchema,
        response: { 200: successEnvelope(clientSchema) },
      },
    },
    getClientHandler,
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: ["Clients"],
        summary: "Update a client",
        security: [{ bearerAuth: [] }],
        params: clientIdParamsSchema,
        body: updateClientSchema,
        response: { 200: successEnvelope(clientSchema) },
      },
    },
    updateClientHandler,
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Clients"],
        summary: "Delete a client (must have no invoices attached)",
        security: [{ bearerAuth: [] }],
        params: clientIdParamsSchema,
      },
    },
    deleteClientHandler,
  );
}
