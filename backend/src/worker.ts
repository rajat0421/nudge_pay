/**
 * Standalone worker entrypoint — run this as a separate process/service
 * (`npm run worker:start`) once you want the reminder engine to scale
 * independently of the API. Set RUN_JOBS_IN_API_PROCESS=false so the API
 * process doesn't also run the jobs and double-process the same queue.
 */
import { logger } from "./config/logger";
import { assertDatabaseConnection, prisma } from "./db/prisma";
import { startJobRunner, stopJobRunner } from "./jobs/runner";

async function main(): Promise<void> {
  await assertDatabaseConnection();

  logger.info("starting standalone reminder worker process");
  startJobRunner();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "worker shutting down");
    stopJobRunner();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error({ err: error }, "fatal worker startup error");
  process.exit(1);
});
