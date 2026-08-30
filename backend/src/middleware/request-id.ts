import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

const REQUEST_ID_HEADER = "x-request-id";

/** Accepts an inbound X-Request-Id (useful behind a proxy/load balancer), or generates one. */
export function generateRequestId(req: { headers: Record<string, unknown> }): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  return typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
}

/** Echoes the resolved request ID back on every response. */
export function registerRequestId(app: FastifyInstance): void {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", request.id);
  });
}
