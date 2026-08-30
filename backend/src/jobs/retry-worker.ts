import { env } from "../config/env";
import { logger } from "../config/logger";
import { RETRY_BACKOFF_MINUTES, STUCK_PROCESSING_THRESHOLD_MINUTES } from "../config/constants";
import * as remindersRepository from "../modules/reminders/reminders.repository";

/**
 * Attempt 1 fails -> retry in 5 minutes
 * Attempt 2 fails -> retry in 30 minutes
 * Attempt 3 fails -> retry in 2 hours
 * Beyond the configured backoff steps, keep reusing the last (longest) delay
 * until MAX_EMAIL_RETRIES is hit and the event is marked FAILED for good.
 */
export function computeBackoffMinutes(attempts: number): number {
  const index = Math.min(attempts - 1, RETRY_BACKOFF_MINUTES.length - 1);
  return RETRY_BACKOFF_MINUTES[Math.max(index, 0)] ?? RETRY_BACKOFF_MINUTES[0];
}

export interface HandleSendFailureParams {
  eventId: string;
  attempts: number;
  error: string;
}

/**
 * Called by the worker whenever a send throws. Bumps the attempt count and
 * either reschedules the event (still PENDING, further in the future) or
 * marks it permanently FAILED once MAX_EMAIL_RETRIES is exceeded.
 */
export async function handleSendFailure({ eventId, attempts, error }: HandleSendFailureParams): Promise<void> {
  if (attempts >= env.MAX_EMAIL_RETRIES) {
    await remindersRepository.markEventFailedPermanently(eventId, attempts, error);
    logger.error({ eventId, attempts, error }, "reminder event permanently failed");
    return;
  }

  const backoffMinutes = computeBackoffMinutes(attempts);
  const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60_000);
  await remindersRepository.markEventRetry(eventId, attempts, nextAttemptAt, error);
  logger.warn({ eventId, attempts, backoffMinutes, error }, "reminder event send failed, retry scheduled");
}

/** Crash recovery: releases events a worker died while holding (stuck in PROCESSING). */
export async function recoverStuckEvents(): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_PROCESSING_THRESHOLD_MINUTES * 60_000);
  const { count } = await remindersRepository.recoverStuckProcessingEvents(cutoff);
  if (count > 0) {
    logger.warn({ count }, "recovered reminder events stuck in PROCESSING");
  }
}
