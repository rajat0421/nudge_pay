import "fastify";
import type { OrganizationRole } from "@prisma/client";

export interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  role: OrganizationRole;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthenticatedUser;
  }
}
