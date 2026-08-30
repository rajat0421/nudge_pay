import type { Automation } from "@/types/automation";
import type { Customer } from "@/types/customer";
import type { Invoice } from "@/types/invoice";

// No demo data — every store seeds from these as empty collections until the
// app is wired to the real backend. Kept as the single seam where real API
// data will replace these once that integration happens.

export const customers: Customer[] = [];

export const automations: Automation[] = [];

export const invoices: Invoice[] = [];

export interface ActivityItem {
  id: string;
  at: string;
  kind: "reminder_sent" | "reminder_failed" | "invoice_paid" | "invoice_created" | "automation_changed";
  title: string;
  detail: string;
}

export const activity: ActivityItem[] = [];

export const monthlyStats: Array<{ month: string; outstanding: number; collected: number }> = [];
