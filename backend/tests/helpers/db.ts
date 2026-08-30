import { prisma } from "../../src/db/prisma";

/** Wipes all tables between tests. Safe because tests run against a dedicated test database. */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_logs",
      "reminder_events",
      "reminder_steps",
      "email_templates",
      "reminder_sequences",
      "invoices",
      "clients",
      "refresh_tokens",
      "organization_members",
      "organizations",
      "users"
    RESTART IDENTITY CASCADE
  `);
}
