import { PrismaClient } from "@prisma/client";
import { isProduction } from "../config/env";
import { logger } from "../config/logger";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Reuse a single client across module reloads in dev (tsx watch) to avoid
// exhausting the connection pool. This is the ONLY PrismaClient instance in
// the codebase — every module imports `prisma` from here.
export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: isProduction ? ["error", "warn"] : ["warn", "error"],
  });

if (!isProduction) {
  global.__prisma = prisma;
}

/**
 * Verifies the Supabase connection is actually reachable before the process
 * starts serving traffic or claiming reminder events — a broken
 * DATABASE_URL should fail loudly at boot, never surface later as a
 * confusing runtime error on the first real query.
 */
export async function assertDatabaseConnection(): Promise<void> {
  try {
    await prisma.$connect();
  } catch (error) {
    logger.error({ err: error }, "could not connect to the database — check DATABASE_URL");
    throw error;
  }
}
