import { api, type PaginatedResponse } from "@/lib/api";
import type { Invoice, InvoiceDetail, InvoiceStatus } from "@/types/invoice";

export interface ListInvoicesParams {
  page?: number | undefined;
  limit?: number | undefined;
  status?: InvoiceStatus | undefined;
  clientId?: string | undefined;
  search?: string | undefined;
  sortBy?: "dueDate" | "createdAt" | "amount" | "invoiceNumber" | undefined;
  sortOrder?: "asc" | "desc" | undefined;
}

function toQueryString(params: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as Array<[string, unknown]>) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function listInvoices(params: ListInvoicesParams = {}): Promise<PaginatedResponse<Invoice>> {
  return api.get<PaginatedResponse<Invoice>>(`/invoices${toQueryString(params)}`);
}

export function getInvoice(id: string): Promise<InvoiceDetail> {
  return api.get<InvoiceDetail>(`/invoices/${id}`);
}

export interface CreateInvoiceInput {
  clientId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  paymentUrl?: string | undefined;
  reminderSequenceId?: string | undefined;
}

export function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  return api.post<Invoice>("/invoices", input);
}

export interface UpdateInvoiceInput {
  clientId?: string;
  invoiceNumber?: string;
  amount?: number;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  paymentUrl?: string;
  reminderSequenceId?: string | null;
  status?: "CANCELLED";
}

export function updateInvoice(id: string, input: UpdateInvoiceInput): Promise<InvoiceDetail> {
  return api.patch<InvoiceDetail>(`/invoices/${id}`, input);
}

export function deleteInvoice(id: string): Promise<void> {
  return api.del<void>(`/invoices/${id}`);
}

export function markInvoicePaid(id: string): Promise<InvoiceDetail> {
  return api.post<InvoiceDetail>(`/invoices/${id}/mark-paid`);
}

export function pauseInvoiceReminders(id: string): Promise<InvoiceDetail> {
  return api.post<InvoiceDetail>(`/invoices/${id}/pause-reminders`);
}

export function resumeInvoiceReminders(id: string): Promise<InvoiceDetail> {
  return api.post<InvoiceDetail>(`/invoices/${id}/resume-reminders`);
}
