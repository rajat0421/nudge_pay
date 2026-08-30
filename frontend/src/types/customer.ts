export interface Customer {
  id: string;
  name: string;
  contactName: string;
  email: string;
  company: string;
  outstanding: number;
  avgDaysToPay: number;
  invoiceCount: number;
  createdAt: string;
}
