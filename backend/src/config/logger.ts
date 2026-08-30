import pino from "pino";
import { isProduction } from "./env";

/**
 * Shared logger for code that runs outside a request context (jobs, audit
 * log, startup). Fastify's per-request logger (with request-id/user/org
 * bindings) is configured separately in app.ts.
 */
export const logger = pino({
  level: isProduction ? "info" : "debug",
  transport: isProduction ? undefined : { target: "pino-pretty", options: { colorize: true } },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "req.headers.authorization",
      "accessToken",
      "refreshToken",
      "*.accessToken",
      "*.refreshToken",
    ],
    censor: "[redacted]",
  },
});
