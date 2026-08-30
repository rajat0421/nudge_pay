import { create } from "zustand";
import { invoices as seedInvoices } from "@/lib/mock-db";
import type { Invoice } from "@/types/invoice";

interface InvoiceState {
  invoices: Invoice[];
  addInvoice: (invoice: Invoice) => void;
  markPaid: (id: string) => void;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  invoices: seedInvoices,
  addInvoice: (invoice) => set((s) => ({ invoices: [invoice, ...s.invoices] })),
  markPaid: (id) =>
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === id
          ? {
              ...inv,
              status: "paid" as const,
              reminders: inv.reminders.filter((r) => r.state !== "scheduled"),
            }
          : inv,
      ),
    })),
}));
