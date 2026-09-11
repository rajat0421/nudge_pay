import { buildApp } from "./app";
import { env } from "./config/env";
import { assertDatabaseConnection } from "./db/supabase";
import { startJobRunner, stopJobRunner } from "./jobs/runner";

async function main(): Promise<void> {
  // Fail fast and loud on a bad DATABASE_URL — never start accepting
  // traffic against a database we can't actually reach.
  await assertDatabaseConnection();

  const app = await buildApp();

  if (env.RUN_JOBS_IN_API_PROCESS === "true") {
    startJobRunner();
  }

  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    stopJobRunner();
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
