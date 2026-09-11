import { supabase, unwrap, unwrapVoid, type Row } from "../../db/supabase";
import {
  mapOrganization,
  mapOrganizationMember,
  mapRefreshToken,
  mapUser,
  type OrganizationMemberRow,
  type OrganizationRow,
  type RefreshTokenRow,
  type UserRow,
} from "../../db/mappers";

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const row = unwrap<Row | null>(
    await supabase.from("users").select("*").eq("email", email).maybeSingle(),
  );
  return row && mapUser(row);
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const row = unwrap<Row | null>(
    await supabase.from("users").select("*").eq("id", id).maybeSingle(),
  );
  return row && mapUser(row);
}

export interface CreateUserWithOrganizationInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

/** Registration is one atomic operation: user + organization + OWNER membership. */
export async function createUserWithOrganization(
  input: CreateUserWithOrganizationInput,
): Promise<{ user: UserRow; organization: OrganizationRow }> {
  const result = unwrap<{ user: Row; organization: Row }>(
    await supabase.rpc("register_user_with_organization", {
      p_email: input.email,
      p_password_hash: input.passwordHash,
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_organization_name: input.organizationName,
    }),
  );
  return { user: mapUser(result.user), organization: mapOrganization(result.organization) };
}

export async function touchLastLogin(userId: string): Promise<void> {
  unwrapVoid(
    await supabase.from("users").update({ lastLoginAt: new Date().toISOString() }).eq("id", userId),
  );
}

/**
 * V1 has no organization-switching UI, so a user's "active" organization is
 * simply the first one they joined. See auth.service.ts for the rationale.
 */
export async function getPrimaryMembership(
  userId: string,
): Promise<(OrganizationMemberRow & { organization: OrganizationRow }) | null> {
  const row = unwrap<(Row & { organization: Row }) | null>(
    await supabase
      .from("organization_members")
      .select("*, organization:organizations(*)")
      .eq("userId", userId)
      .order("createdAt", { ascending: true })
      .limit(1)
      .maybeSingle(),
  );
  if (!row) return null;
  return { ...mapOrganizationMember(row), organization: mapOrganization(row.organization) };
}

export async function getMembership(
  userId: string,
  organizationId: string,
): Promise<OrganizationMemberRow | null> {
  const row = unwrap<Row | null>(
    await supabase
      .from("organization_members")
      .select("*")
      .eq("userId", userId)
      .eq("organizationId", organizationId)
      .maybeSingle(),
  );
  return row && mapOrganizationMember(row);
}

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export async function createRefreshToken(input: CreateRefreshTokenInput): Promise<RefreshTokenRow> {
  const row = unwrap<Row>(
    await supabase
      .from("refresh_tokens")
      .insert({
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt.toISOString(),
      })
      .select()
      .single(),
  );
  return mapRefreshToken(row);
}

export async function findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
  const row = unwrap<Row | null>(
    await supabase.from("refresh_tokens").select("*").eq("tokenHash", tokenHash).maybeSingle(),
  );
  return row && mapRefreshToken(row);
}

export async function rotateRefreshToken(id: string, replacedByTokenHash: string): Promise<void> {
  unwrapVoid(
    await supabase
      .from("refresh_tokens")
      .update({ revokedAt: new Date().toISOString(), replacedByTokenHash })
      .eq("id", id),
  );
}

export async function revokeRefreshTokenByHash(tokenHash: string): Promise<void> {
  unwrapVoid(
    await supabase
      .from("refresh_tokens")
      .update({ revokedAt: new Date().toISOString() })
      .eq("tokenHash", tokenHash)
      .is("revokedAt", null),
  );
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  unwrapVoid(
    await supabase
      .from("refresh_tokens")
      .update({ revokedAt: new Date().toISOString() })
      .eq("userId", userId)
      .is("revokedAt", null),
  );
}
