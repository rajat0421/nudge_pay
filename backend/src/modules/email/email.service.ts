import { env } from "../../config/env";
import { HttpEmailProvider } from "./providers/http.provider";
import { ConsoleEmailProvider } from "./providers/console.provider";
import type { EmailProvider, SendEmailParams, SendEmailResult } from "./email.types";

let provider: EmailProvider = env.EMAIL_SERVICE_API_KEY
  ? new HttpEmailProvider(env.EMAIL_SERVICE_URL, env.EMAIL_SERVICE_API_KEY)
  : new ConsoleEmailProvider();

export function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  return provider.send(params);
}

/** Test/DI hook — lets tests substitute a fake provider without touching env vars. */
export function setEmailProvider(customProvider: EmailProvider): void {
  provider = customProvider;
}
