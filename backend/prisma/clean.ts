/* eslint-disable no-console */
/**
 * Wipes every row from every NudgePay table — including whatever
 * `prisma db seed` created. Destructive and irreversible: it truncates the
 * live database `DATABASE_URL` points at. There is no confirmation prompt —
 * think before running this against anything other than a database you
 * intend to empty.
 *
 * Usage: npm run db:clean
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Wiping all NudgePay data from the database...");

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

  console.log("Done — every table is now empty.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
