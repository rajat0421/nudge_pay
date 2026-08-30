import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";
import type { AccessTokenPayload } from "../modules/auth/auth.types";

/**
 * Verifies the Bearer access token and attaches `request.authUser`. Every
 * tenant-scoped route depends on this running first — it is what makes
 * organizationId scoping possible without trusting client-supplied values.
 */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }

  const token = header.slice("Bearer ".length).trim();

  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }

  if (payload.type !== "access") {
    throw new UnauthorizedError("Invalid token type");
  }

  request.authUser = {
    userId: payload.sub,
    organizationId: payload.organizationId,
    role: payload.role,
  };
}

/** Restricts a route to specific organization roles, e.g. requireRole("OWNER"). */
export function requireRole(...roles: Array<"OWNER" | "ADMIN" | "MEMBER">) {
  return async function roleGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.authUser) {
      throw new UnauthorizedError("Authentication required");
    }
    if (!roles.includes(request.authUser.role)) {
      throw new ForbiddenError("You do not have permission to perform this action");
    }
  };
}
