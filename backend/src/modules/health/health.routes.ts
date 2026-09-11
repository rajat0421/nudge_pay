import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabase } from "../../db/supabase";
import { ok, fail } from "../../utils/response";
import { errorEnvelopeSchema, successEnvelope } from "../../utils/openapi";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Liveness/readiness check — verifies the database is reachable",
        response: {
          200: successEnvelope(z.object({ status: z.literal("ok") })),
          503: errorEnvelopeSchema,
        },
      },
    },
    async (_request, reply) => {
      const { error } = await supabase.from("organizations").select("id").limit(1);
      if (error) {
        return reply.status(503).send(fail("SERVICE_UNAVAILABLE", "Database is unreachable"));
      }
      return reply.status(200).send(ok({ status: "ok" as const }));
    },
  );
}
