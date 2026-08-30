import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { ok, fail } from "../../utils/response";
import { successEnvelope } from "../../utils/openapi";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Liveness/readiness check — verifies the database is reachable",
        response: { 200: successEnvelope(z.object({ status: z.literal("ok") })) },
      },
    },
    async (_request, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return reply.status(200).send(ok({ status: "ok" as const }));
      } catch {
        return reply.status(503).send(fail("SERVICE_UNAVAILABLE", "Database is unreachable"));
      }
    },
  );
}
