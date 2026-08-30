import jwt from "jsonwebtoken";
import type { OrganizationRole } from "@prisma/client";
import { env } from "../../config/env";
import { parseDurationToMs } from "../../utils/duration";
import { hashPassword, verifyPassword, generateOpaqueToken, sha256 } from "../../utils/crypto";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../../utils/errors";
import { recordAuditLog } from "../audit/audit.service";
import * as authRepository from "./auth.repository";
import type { AccessTokenPayload, AuthTokens, RefreshTokenPayload, SafeUser } from "./auth.types";
import type { LoginInput, RegisterInput } from "./auth.schemas";

function toSafeUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function signAccessToken(userId: string, organizationId: string, role: OrganizationRole): string {
  const payload: AccessTokenPayload = { sub: userId, organizationId, role, type: "access" };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

function signRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = { sub: userId, jti: generateOpaqueToken(), type: "refresh" };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

async function issueTokenPair(
  userId: string,
  organizationId: string,
  role: OrganizationRole,
): Promise<AuthTokens> {
  const accessToken = signAccessToken(userId, organizationId, role);
  const refreshToken = signRefreshToken(userId);

  await authRepository.createRefreshToken({
    userId,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + parseDurationToMs(env.REFRESH_TOKEN_EXPIRES_IN)),
  });

  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput) {
  const existing = await authRepository.findUserByEmail(input.email);
  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const { user, organization, membership } = await authRepository.createUserWithOrganization({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    organizationName: input.organizationName,
  });

  const tokens = await issueTokenPair(user.id, organization.id, membership.role);

  await recordAuditLog({
    organizationId: organization.id,
    userId: user.id,
    action: "auth.register",
    entityType: "User",
    entityId: user.id,
  });

  return { user: toSafeUser(user), organization, tokens };
}

export async function login(input: LoginInput) {
  const user = await authRepository.findUserByEmail(input.email);
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);
  if (!passwordValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const membership = await authRepository.getPrimaryMembership(user.id);
  if (!membership) {
    throw new ForbiddenError("This account is not attached to an organization");
  }

  await authRepository.touchLastLogin(user.id);
  const tokens = await issueTokenPair(user.id, membership.organizationId, membership.role);

  await recordAuditLog({
    organizationId: membership.organizationId,
    userId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
  });

  return { user: toSafeUser(user), organization: membership.organization, tokens };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
  if (payload.type !== "refresh") {
    throw new UnauthorizedError("Invalid token type");
  }

  const tokenHash = sha256(refreshToken);
  const stored = await authRepository.findRefreshTokenByHash(tokenHash);

  if (!stored || stored.userId !== payload.sub) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  if (stored.revokedAt) {
    // This exact token was already rotated or revoked once before — reuse of
    // a stale refresh token strongly suggests it was stolen. Nuke the whole
    // session chain for this user as a precaution.
    await authRepository.revokeAllUserRefreshTokens(payload.sub);
    throw new UnauthorizedError("Refresh token has already been used; all sessions revoked");
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const membership = await authRepository.getPrimaryMembership(payload.sub);
  if (!membership) {
    throw new ForbiddenError("This account is not attached to an organization");
  }

  const tokens = await issueTokenPair(payload.sub, membership.organizationId, membership.role);
  await authRepository.rotateRefreshToken(stored.id, sha256(tokens.refreshToken));

  return tokens;
}

export async function logout(refreshToken: string): Promise<void> {
  await authRepository.revokeRefreshTokenByHash(sha256(refreshToken));
}

export async function me(userId: string) {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw new UnauthorizedError("User not found");
  }
  const membership = await authRepository.getPrimaryMembership(userId);
  return { user: toSafeUser(user), organization: membership?.organization ?? null, role: membership?.role ?? null };
}
