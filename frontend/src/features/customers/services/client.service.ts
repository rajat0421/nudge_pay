import { api, type PaginatedResponse } from "@/lib/api";
import type { Client } from "@/types/customer";

export interface ListClientsParams {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  sortBy?: "name" | "email" | "createdAt" | undefined;
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

export function listClients(params: ListClientsParams = {}): Promise<PaginatedResponse<Client>> {
  return api.get<PaginatedResponse<Client>>(`/clients${toQueryString(params)}`);
}

export function getClient(id: string): Promise<Client> {
  return api.get<Client>(`/clients/${id}`);
}

export interface CreateClientInput {
  name: string;
  companyName?: string | undefined;
  email: string;
  phone?: string | undefined;
  notes?: string | undefined;
}

export function createClient(input: CreateClientInput): Promise<Client> {
  return api.post<Client>("/clients", input);
}

export type UpdateClientInput = Partial<CreateClientInput>;

export function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  return api.patch<Client>(`/clients/${id}`, input);
}

export function deleteClient(id: string): Promise<void> {
  return api.del<void>(`/clients/${id}`);
}
