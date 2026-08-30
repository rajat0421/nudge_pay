import { env } from "../config/env";
import { logger } from "../config/logger";
import { syncInvoiceStatuses } from "./reminder-scheduler";
import { runReminderWorker } from "./reminder-worker";
import { recoverStuckEvents } from "./retry-worker";

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

async function tick(): Promise<void> {
  if (tickInFlight) {
    // A previous tick is still running (e.g. a slow email provider) — skip
    // this one rather than overlapping ticks and double-claiming work.
    return;
  }
  tickInFlight = true;
  try {
    await recoverStuckEvents();
    await syncInvoiceStatuses();
    await runReminderWorker();
  } catch (error) {
    logger.error({ err: error }, "job runner tick failed");
  } finally {
    tickInFlight = false;
  }
}

/**
 * Starts the PostgreSQL-backed job loop — no Redis/queue required. Can run
 * in the same process as the API (simplest, fine for V1 scale) or as a
 * separate `worker` process/service (see src/worker.ts) once the API and
 * reminder volume need to scale independently.
 */
export function startJobRunner(): void {
  if (intervalHandle) return;
  const intervalMs = env.CRON_INTERVAL_MINUTES * 60_000;
  logger.info({ intervalMinutes: env.CRON_INTERVAL_MINUTES }, "starting reminder job runner");
  intervalHandle = setInterval(() => {
    void tick();
  }, intervalMs);
  // Run once immediately on boot instead of waiting for the first interval.
  void tick();
}

export function stopJobRunner(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
