export interface User {
  id: string;
  name: string;
  email: string;
  organization: string;
  plan: "trialing" | "starter" | "pro";
  timezone: string;
  senderName: string;
  senderEmail: string;
}
