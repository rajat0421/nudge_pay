/** Named `Client` to match the backend's terminology exactly — the UI still calls this "Customers". */
export interface Client {
  id: string;
  organizationId: string;
  name: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
