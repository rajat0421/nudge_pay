import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { fail } from "../utils/response";

/** Global, generous rate limit — protects the API from accidental hammering. */
export async function registerGlobalRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    errorResponseBuilder: () =>
      fail("TOO_MANY_REQUESTS", "Too many requests — please slow down"),
  });
}

/** Stricter limit applied to auth endpoints to slow down credential-stuffing/brute force. */
export const authRateLimitConfig = {
  rateLimit: {
    max: 10,
    timeWindow: "1 minute",
  },
};
