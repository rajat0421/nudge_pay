import type { Invoice, InvoiceStatus } from "@/types/invoice";

export function filterInvoices(
  invoices: Invoice[],
  { status, query }: { status: InvoiceStatus | "all"; query: string },
) {
  const q = query.trim().toLowerCase();
  return invoices.filter((invoice) => {
    const statusOk = status === "all" ? true : invoice.status === status;
    const queryOk =
      q.length === 0 ||
      invoice.number.toLowerCase().includes(q) ||
      invoice.customerName.toLowerCase().includes(q);
    return statusOk && queryOk;
  });
}

export function summarize(invoices: Invoice[]) {
  const sum = (list: Invoice[]) => list.reduce((total, i) => total + i.amount, 0);
  const outstanding = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const paid = invoices.filter((i) => i.status === "paid");
  const reminders = invoices.flatMap((i) => i.reminders);

  return {
    outstanding: sum(outstanding),
    outstandingCount: outstanding.length,
    overdue: sum(overdue),
    paid: sum(paid),
    overdueCount: overdue.length,
    remindersSent: reminders.filter((r) => r.state === "sent").length,
    remindersFailed: reminders.filter((r) => r.state === "failed").length,
  };
}
