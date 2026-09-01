export const APP_NAME = "NudgePay";
export const APP_TAGLINE = "Stop chasing overdue invoices";

export const INVOICE_STATUS_LABELS = {
  draft: "Draft",
  sent: "Sent",
  overdue: "Overdue",
  paid: "Paid",
} as const;

export const CURRENCIES = ["USD", "EUR", "GBP", "INR"] as const;

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
] as const;

export const PAGE_SIZE = 6;
