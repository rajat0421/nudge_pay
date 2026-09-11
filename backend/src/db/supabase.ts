import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError, ConflictError } from "../utils/errors";

/**
 * The only Supabase client in the codebase — every module imports it from
 * here. Uses the service-role key (bypasses Row Level Security), since
 * tenant isolation is enforced entirely in the application layer (every
 * repository query filters by organizationId, exactly as before). This key
 * must never reach the frontend.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Result<T> {
  data: T | null;
  error: PostgrestError | null;
}

/**
 * Generic raw row shape — the Supabase client here has no generated
 * `Database` type (no schema-to-types codegen step is wired up), so every
 * table/RPC's row type is effectively `any` at the query builder
 * level. Callers of `unwrap` MUST pass an explicit type
 * argument (`unwrap<Row>(...)`, never a bare `unwrap(...)`) — leaving it to
 * infer from an `any`-shaped argument produces bogus results (empirically,
 * `null`) rather than a compile error, so this isn't just a style
 * preference. The actual shape is then narrowed by the mapper functions in
 * `db/mappers.ts`.
 */
export type Row = Record<string, unknown>;

/** PGRST116 = "no rows" from .single()/.maybeSingle() — never an app error. */
const NO_ROWS_CODE = "PGRST116";

function mapPostgrestError(error: PostgrestError): AppError {
  if (error.code === "23505") {
    return new ConflictError("A record with these values already exists");
  }
  if (error.code === "23503") {
    return new ConflictError("This action conflicts with a related record");
  }
  return new AppError(500, "DATABASE_ERROR", error.message);
}

/** Throws a mapped AppError on any real error; returns data (possibly null) otherwise. */
export function unwrap<T>(result: Result<T>): T {
  if (result.error && result.error.code !== NO_ROWS_CODE) {
    throw mapPostgrestError(result.error);
  }
  return result.data as T;
}

/** Like unwrap, but for mutations where only a possible error matters. */
export function unwrapVoid(result: { error: PostgrestError | null }): void {
  if (result.error) throw mapPostgrestError(result.error);
}

/**
 * Escapes the characters that are structurally significant in PostgREST's
 * `.or()` filter syntax (`,`, `(`, `)`) out of user-supplied search text, so
 * a search string can never break the filter expression or smuggle in an
 * unintended condition.
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, " ").trim();
}

/**
 * Verifies Supabase is actually reachable before the process starts serving
 * traffic or claiming reminder events — a broken SUPABASE_URL/service-role
 * key should fail loudly at boot, never surface later as a confusing
 * runtime error on the first real query.
 */
export async function assertDatabaseConnection(): Promise<void> {
  const { error } = await supabase.from("organizations").select("id").limit(1);
  if (error) {
    logger.error({ err: error }, "could not reach Supabase — check SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY");
    throw new Error(`Supabase connection check failed: ${error.message}`);
  }
}
