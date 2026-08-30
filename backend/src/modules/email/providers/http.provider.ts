import type { EmailProvider, SendEmailParams, SendEmailResult } from "../email.types";

/**
 * Sends through NudgePay's shared email-service HTTP endpoint — a plain
 * POST with an API key header, no SMTP, no Resend. See NudgePay's own
 * config/env.ts for EMAIL_SERVICE_URL / EMAIL_SERVICE_API_KEY.
 */
export class HttpEmailProvider implements EmailProvider {
  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        html: params.html,
        fromName: params.fromName,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Email service responded ${response.status} ${response.statusText}: ${body.slice(0, 500)}`,
      );
    }

    const data: unknown = await response.json().catch(() => ({}));
    const providerMessageId =
      data && typeof data === "object" && "id" in data && typeof (data as { id: unknown }).id === "string"
        ? (data as { id: string }).id
        : undefined;

    return { providerMessageId };
  }
}
