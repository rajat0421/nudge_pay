import type { Client } from "@/types/customer";

export type InvoiceStatus = "DRAFT" | "SENT" | "DUE" | "OVERDUE" | "PAID" | "CANCELLED";

export type ReminderEventStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";

export interface ReminderEvent {
  id: string;
  reminderStepId: string;
  scheduledAt: string;
  sentAt: string | null;
  status: ReminderEventStatus;
  attempts: number;
  lastError: string | null;
  reminderStep: {
    id: string;
    stepOrder: number;
    delayDays: number;
  };
}

export interface Invoice {
  id: string;
  organizationId: string;
  clientId: string;
  reminderSequenceId: string | null;
  invoiceNumber: string;
  /** Major units (e.g. dollars) — the backend converts from minor units at the API edge. */
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  paymentUrl: string | null;
  status: InvoiceStatus;
  paidAt: string | null;
  remindersPaused: boolean;
  createdAt: string;
  updatedAt: string;
  client: Client;
}

export interface InvoiceDetail extends Invoice {
  reminderSequence: {
    id: string;
    name: string;
    steps: Array<{ id: string; stepOrder: number; delayDays: number }>;
  } | null;
  reminderEvents: ReminderEvent[];
}
