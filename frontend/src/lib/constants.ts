export const APP_NAME = "NudgePay";
export const APP_TAGLINE = "Stop chasing overdue invoices";

export const INVOICE_STATUS_LABELS = {
  DRAFT: "Draft",
  SENT: "Sent",
  DUE: "Due soon",
  OVERDUE: "Overdue",
  PAID: "Paid",
  CANCELLED: "Cancelled",
} as const;

export const REMINDER_EVENT_STATUS_LABELS = {
  PENDING: "Scheduled",
  PROCESSING: "Sending",
  SENT: "Sent",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
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
