import type { OrganizationRole } from "../../db/mappers";

export interface AccessTokenPayload {
  sub: string;
  organizationId: string;
  role: OrganizationRole;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: "refresh";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}
