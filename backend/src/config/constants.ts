export const API_PREFIX = "/api/v1";

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Backoff schedule for reminder-send retries, indexed by attempt number
 * (attempts is incremented before the delay is looked up, so attempt 1 is
 * the first retry after the original send failed).
 *   Attempt 1 -> retry in 5 minutes
 *   Attempt 2 -> retry in 30 minutes
 *   Attempt 3 -> retry in 2 hours
 * After MAX_EMAIL_RETRIES attempts the event is marked FAILED permanently.
 */
export const RETRY_BACKOFF_MINUTES = [5, 30, 120] as const;

export const ORGANIZATION_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;

export const STUCK_PROCESSING_THRESHOLD_MINUTES = 15;
