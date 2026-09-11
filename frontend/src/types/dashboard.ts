import type { Invoice, ReminderEventStatus } from "@/types/invoice";

export interface DashboardSummary {
  outstandingAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
  totalInvoices: number;
  overdueCount: number;
  upcomingDueInvoices: Invoice[];
}

export interface ActivityItem {
  id: string;
  status: ReminderEventStatus;
  sentAt: string | null;
  updatedAt: string;
  attempts: number;
  lastError: string | null;
  invoice: Invoice;
  reminderStep: { id: string; stepOrder: number; delayDays: number };
}
