import "fastify";
import type { OrganizationRole } from "../db/mappers";

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
