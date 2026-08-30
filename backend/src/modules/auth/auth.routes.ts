import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { authRateLimitConfig } from "../../middleware/rate-limit";
import { successEnvelope } from "../../utils/openapi";
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from "./auth.schemas";
import { loginHandler, logoutHandler, meHandler, refreshHandler, registerHandler } from "./auth.controller";

const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/register",
    {
      config: authRateLimitConfig,
      schema: {
        tags: ["Auth"],
        summary: "Register a new user and organization",
        body: registerSchema,
        response: {
          201: successEnvelope(
            z.object({
              user: z.any(),
              organization: z.any(),
              tokens: authTokensSchema,
            }),
          ),
        },
      },
    },
    registerHandler,
  );

  app.post(
    "/login",
    {
      config: authRateLimitConfig,
      schema: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        body: loginSchema,
        response: {
          200: successEnvelope(
            z.object({
              user: z.any(),
              organization: z.any(),
              tokens: authTokensSchema,
            }),
          ),
        },
      },
    },
    loginHandler,
  );

  app.post(
    "/refresh",
    {
      schema: {
        tags: ["Auth"],
        summary: "Exchange a refresh token for a new token pair (rotates the refresh token)",
        body: refreshSchema,
        response: { 200: successEnvelope(authTokensSchema) },
      },
    },
    refreshHandler,
  );

  app.post(
    "/logout",
    {
      schema: {
        tags: ["Auth"],
        summary: "Revoke a refresh token",
        body: logoutSchema,
      },
    },
    logoutHandler,
  );

  app.get(
    "/me",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["Auth"],
        summary: "Return the current user, their active organization and role",
        security: [{ bearerAuth: [] }],
        response: {
          200: successEnvelope(
            z.object({ user: z.any(), organization: z.any().nullable(), role: z.any().nullable() }),
          ),
        },
      },
    },
    meHandler,
  );
}
