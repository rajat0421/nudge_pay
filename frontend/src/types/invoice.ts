export type InvoiceStatus = "draft" | "sent" | "overdue" | "paid";

export type ReminderState = "sent" | "scheduled" | "failed";

export interface ReminderEvent {
  id: string;
  step: number;
  label: string;
  offsetDays: number;
  date: string;
  state: ReminderState;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paymentUrl: string;
  automationId: string;
  reminders: ReminderEvent[];
}
