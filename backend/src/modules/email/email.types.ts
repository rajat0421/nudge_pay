export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Display name shown as the sender — the organization's own name, not NudgePay's. */
  fromName: string;
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  providerMessageId?: string;
}

/**
 * Every outbound email goes through this interface — invoice/reminder logic
 * never talks to a specific provider directly, so swapping providers or
 * adding a second one later (V2) touches only this module.
 */
export interface EmailProvider {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
