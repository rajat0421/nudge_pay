import { logger } from "../../../config/logger";
import type { EmailProvider, SendEmailParams, SendEmailResult } from "../email.types";

/**
 * Used whenever EMAIL_SERVICE_API_KEY is unset (local dev, CI, tests) — logs
 * the rendered email instead of sending it, so the reminder engine can be
 * exercised end to end with zero external dependencies.
 */
export class ConsoleEmailProvider implements EmailProvider {
  async send(params: SendEmailParams): Promise<SendEmailResult> {
    logger.info(
      { to: params.to, subject: params.subject, fromName: params.fromName },
      "[console-email] EMAIL_SERVICE_API_KEY not set — logging instead of sending",
    );
    return { providerMessageId: `console-${randomId()}` };
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}
