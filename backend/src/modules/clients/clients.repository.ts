import { sanitizeSearchTerm, supabase, unwrap, type Row } from "../../db/supabase";
import { mapClient, type ClientRow } from "../../db/mappers";
import type { CreateClientInput, ListClientsQuery, UpdateClientInput } from "./clients.schemas";

function applySearch<T>(query: T, organizationId: string, search?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query;
  q = q.eq("organizationId", organizationId);
  if (search) {
    const term = sanitizeSearchTerm(search);
    q = q.or(`name.ilike.*${term}*,companyName.ilike.*${term}*,email.ilike.*${term}*`);
  }
  return q;
}

export async function listClients(
  organizationId: string,
  query: ListClientsQuery & { skip: number; take: number },
): Promise<ClientRow[]> {
  let q = supabase.from("clients").select("*");
  q = applySearch(q, organizationId, query.search);
  q = q
    .order(query.sortBy, { ascending: query.sortOrder === "asc" })
    .range(query.skip, query.skip + query.take - 1);
  const rows = unwrap<Row[]>(await q);
  return (rows ?? []).map(mapClient);
}

export async function countClients(organizationId: string, search?: string): Promise<number> {
  let q = supabase.from("clients").select("*", { count: "exact", head: true });
  q = applySearch(q, organizationId, search);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function createClient(
  organizationId: string,
  data: CreateClientInput,
): Promise<ClientRow> {
  const row = unwrap<Row>(
    await supabase
      .from("clients")
      .insert({ ...data, organizationId })
      .select()
      .single(),
  );
  return mapClient(row);
}

/** Always scoped by organizationId — a client from another org resolves to null, never leaking existence. */
export async function findClientById(organizationId: string, id: string): Promise<ClientRow | null> {
  const row = unwrap<Row | null>(
    await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .eq("organizationId", organizationId)
      .maybeSingle(),
  );
  return row && mapClient(row);
}

export async function updateClient(
  organizationId: string,
  id: string,
  data: UpdateClientInput,
): Promise<{ count: number }> {
  const rows = unwrap<Row[]>(
    await supabase
      .from("clients")
      .update(data)
      .eq("id", id)
      .eq("organizationId", organizationId)
      .select("id"),
  );
  return { count: rows?.length ?? 0 };
}

export async function deleteClient(organizationId: string, id: string): Promise<{ count: number }> {
  const rows = unwrap<Row[]>(
    await supabase
      .from("clients")
      .delete()
      .eq("id", id)
      .eq("organizationId", organizationId)
      .select("id"),
  );
  return { count: rows?.length ?? 0 };
}

export async function countInvoicesForClient(organizationId: string, clientId: string): Promise<number> {
  const { count, error } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("organizationId", organizationId)
    .eq("clientId", clientId);
  if (error) throw error;
  return count ?? 0;
}
