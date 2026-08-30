import "dotenv/config";
import { afterAll, beforeAll } from "vitest";
import { prisma } from "../src/db/prisma";
import { resetDatabase } from "./helpers/db";

if (process.env.NODE_ENV !== "test") {
  throw new Error(
    "Tests must run with NODE_ENV=test against a dedicated test database — refusing to run against a non-test DATABASE_URL.",
  );
}

// Truncates once per test FILE, before that file's own fixtures are created
// (vitest runs root-level setupFile hooks before a describe block's own
// beforeAll). Every query in the app is tenant-scoped by organizationId and
// each test file registers its own fresh organization, so tests never need
// isolation from each other beyond starting from a clean, empty database.
beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
