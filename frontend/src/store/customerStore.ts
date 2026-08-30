import { create } from "zustand";
import { customers as seedCustomers } from "@/lib/mock-db";
import type { Customer } from "@/types/customer";

interface CustomerState {
  customers: Customer[];
  addCustomer: (customer: Customer) => void;
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: seedCustomers,
  addCustomer: (customer) => set((s) => ({ customers: [customer, ...s.customers] })),
}));
