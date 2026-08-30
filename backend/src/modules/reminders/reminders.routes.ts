import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { successEnvelope } from "../../utils/openapi";
import {
  createReminderSequenceSchema,
  reminderSequenceIdParamsSchema,
  reminderStepParamsSchema,
  updateReminderSequenceSchema,
  updateReminderStepSchema,
} from "./reminders.schemas";
import {
  createSequenceHandler,
  deleteSequenceHandler,
  getSequenceHandler,
  listSequencesHandler,
  updateSequenceHandler,
  updateStepHandler,
} from "./reminders.controller";

const sequenceSchema = z.any();

export async function remindersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/",
    {
      schema: {
        tags: ["Reminder sequences"],
        summary: "List reminder sequences",
        security: [{ bearerAuth: [] }],
        response: { 200: successEnvelope(z.array(sequenceSchema)) },
      },
    },
    listSequencesHandler,
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Reminder sequences"],
        summary: "Create a reminder sequence with its steps and templates",
        security: [{ bearerAuth: [] }],
        body: createReminderSequenceSchema,
        response: { 201: successEnvelope(sequenceSchema) },
      },
    },
    createSequenceHandler,
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Reminder sequences"],
        summary: "Get a reminder sequence with its steps",
        security: [{ bearerAuth: [] }],
        params: reminderSequenceIdParamsSchema,
        response: { 200: successEnvelope(sequenceSchema) },
      },
    },
    getSequenceHandler,
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: ["Reminder sequences"],
        summary: "Update a reminder sequence (name, description, active state)",
        security: [{ bearerAuth: [] }],
        params: reminderSequenceIdParamsSchema,
        body: updateReminderSequenceSchema,
        response: { 200: successEnvelope(sequenceSchema) },
      },
    },
    updateSequenceHandler,
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Reminder sequences"],
        summary: "Delete a reminder sequence (must have no invoices attached)",
        security: [{ bearerAuth: [] }],
        params: reminderSequenceIdParamsSchema,
      },
    },
    deleteSequenceHandler,
  );

  app.patch(
    "/:id/steps/:stepId",
    {
      schema: {
        tags: ["Reminder sequences"],
        summary: "Update a step's delay and/or its email template subject/body",
        security: [{ bearerAuth: [] }],
        params: reminderStepParamsSchema,
        body: updateReminderStepSchema,
        response: { 200: successEnvelope(sequenceSchema) },
      },
    },
    updateStepHandler,
  );
}
