import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { validatorCompiler, serializerCompiler, jsonSchemaTransform } from "fastify-type-provider-zod";

import { env, isProduction } from "./config/env";
import { API_PREFIX } from "./config/constants";
import { registerErrorHandler } from "./middleware/error-handler";
import { registerRequestId, generateRequestId } from "./middleware/request-id";
import { registerGlobalRateLimit } from "./middleware/rate-limit";

import { authRoutes } from "./modules/auth/auth.routes";
import { organizationsRoutes } from "./modules/organizations/organizations.routes";
import { clientsRoutes } from "./modules/clients/clients.routes";
import { invoicesRoutes } from "./modules/invoices/invoices.routes";
import { remindersRoutes } from "./modules/reminders/reminders.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { healthRoutes } from "./modules/health/health.routes";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    genReqId: generateRequestId,
    trustProxy: true,
    logger: {
      level: isProduction ? "info" : "debug",
      transport: isProduction ? undefined : { target: "pino-pretty", options: { colorize: true } },
      redact: {
        paths: [
          "req.headers.authorization",
          "req.body.password",
          "req.body.refreshToken",
          "res.headers",
        ],
        censor: "[redacted]",
      },
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { global: true });
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
  const isLocalhostOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  await app.register(cors, {
    origin: isProduction
      ? allowedOrigins
      : (origin, callback) => {
          // Local dev tooling (e.g. the frontend's Vite wrapper) can pick a
          // different port each run — trust any localhost origin in
          // development rather than CORS_ORIGIN's fixed port breaking every
          // time that happens. Production still uses the strict allowlist.
          if (!origin || allowedOrigins.includes(origin) || isLocalhostOrigin(origin)) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"), false);
          }
        },
    credentials: true,
  });
  await registerGlobalRateLimit(app);
  registerRequestId(app);
  registerErrorHandler(app);

  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "NudgePay API",
        description: "Invoice follow-up automation for small businesses and agencies.",
        version: "1.0.0",
      },
      servers: [{ url: env.APP_URL }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: `${API_PREFIX}/auth` });
  await app.register(organizationsRoutes, { prefix: `${API_PREFIX}/organizations` });
  await app.register(clientsRoutes, { prefix: `${API_PREFIX}/clients` });
  await app.register(invoicesRoutes, { prefix: `${API_PREFIX}/invoices` });
  await app.register(remindersRoutes, { prefix: `${API_PREFIX}/reminder-sequences` });
  await app.register(dashboardRoutes, { prefix: `${API_PREFIX}/dashboard` });

  return app;
}
