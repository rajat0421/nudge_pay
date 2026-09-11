import { sanitizeSearchTerm, supabase, unwrap, type Row } from "../../db/supabase";
import {
  mapInvoice,
  mapInvoiceWithClient,
  type ClientRow,
  type InvoiceRow,
  type InvoiceStatus,
  type ReminderSequenceRow,
  type ReminderStepRow,
} from "../../db/mappers";

interface SearchOpts {
  status?: InvoiceStatus;
  clientId?: string;
  search?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, organizationId: string, opts: SearchOpts) {
  let q = query.eq("organizationId", organizationId);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.clientId) q = q.eq("clientId", opts.clientId);
  if (opts.search) {
    const term = sanitizeSearchTerm(opts.search);
    // client.name/client.companyName can't be filtered through an embedded
    // resource inside `.or()` — only invoiceNumber is searched directly here.
    // (Matches the practical common case: searching by invoice number.)
    q = q.ilike("invoiceNumber", `%${term}%`);
  }
  return q;
}

type InvoiceSortField = "dueDate" | "createdAt" | "amount" | "invoiceNumber";

export async function listInvoices(
  organizationId: string,
  opts: SearchOpts & {
    sortBy: InvoiceSortField;
    sortOrder: "asc" | "desc";
    skip: number;
    take: number;
  },
): Promise<Array<InvoiceRow & { client: ClientRow }>> {
  let q = supabase.from("invoices").select("*, client:clients(*)");
  q = applyFilters(q, organizationId, opts);
  q = q
    .order(opts.sortBy, { ascending: opts.sortOrder === "asc" })
    .range(opts.skip, opts.skip + opts.take - 1);
  const rows = unwrap<Row[]>(await q);
  return (rows ?? []).map(mapInvoiceWithClient);
}

export async function countInvoices(organizationId: string, opts: SearchOpts): Promise<number> {
  let q = supabase.from("invoices").select("*", { count: "exact", head: true });
  q = applyFilters(q, organizationId, opts);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export interface InvoiceDetail extends InvoiceRow {
  client: ClientRow;
  reminderSequence: (ReminderSequenceRow & { steps: ReminderStepRow[] }) | null;
}

export async function findInvoiceById(
  organizationId: string,
  id: string,
): Promise<InvoiceDetail | null> {
  const row = unwrap<Row | null>(
    await supabase
      .from("invoices")
      .select("*, client:clients(*), reminderSequence:reminder_sequences(*, steps:reminder_steps(*))")
      .eq("id", id)
      .eq("organizationId", organizationId)
      .maybeSingle(),
  );
  if (!row) return null;

  const mapped = mapInvoiceWithClient(row);
  const rawSequence = row.reminderSequence as Row | null;
  const reminderSequence = rawSequence
    ? {
        ...(rawSequence as unknown as ReminderSequenceRow),
        createdAt: new Date(rawSequence.createdAt as string),
        updatedAt: new Date(rawSequence.updatedAt as string),
        steps: ((rawSequence.steps as Row[]) ?? [])
          .map((step) => ({
            ...(step as unknown as ReminderStepRow),
            createdAt: new Date(step.createdAt as string),
            updatedAt: new Date(step.updatedAt as string),
          }))
          .sort((a, b) => a.stepOrder - b.stepOrder),
      }
    : null;

  return { ...mapped, reminderSequence } as InvoiceDetail;
}

export interface CreateInvoiceData {
  clientId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  paymentUrl: string | null;
  reminderSequenceId: string | null;
  status: InvoiceStatus;
}

export async function createInvoice(
  organizationId: string,
  data: CreateInvoiceData,
): Promise<InvoiceRow & { client: ClientRow }> {
  const row = unwrap<Row>(
    await supabase
      .from("invoices")
      .insert({
        organizationId,
        clientId: data.clientId,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        currency: data.currency,
        issueDate: data.issueDate.toISOString(),
        dueDate: data.dueDate.toISOString(),
        paymentUrl: data.paymentUrl,
        reminderSequenceId: data.reminderSequenceId,
        status: data.status,
      })
      .select("*, client:clients(*)")
      .single(),
  );
  return mapInvoiceWithClient(row);
}

export interface InvoiceUpdateData {
  clientId?: string;
  invoiceNumber?: string;
  amount?: number;
  currency?: string;
  issueDate?: Date;
  dueDate?: Date;
  paymentUrl?: string | null;
  reminderSequenceId?: string | null;
  status?: InvoiceStatus;
  paidAt?: Date | null;
  remindersPaused?: boolean;
}

/**
 * Tenant scoping is enforced here (not just by the caller) via the ownership
 * check before the write.
 */
export async function updateInvoice(
  organizationId: string,
  id: string,
  data: InvoiceUpdateData,
): Promise<{ count: number }> {
  const owned = unwrap<Row | null>(
    await supabase
      .from("invoices")
      .select("id")
      .eq("id", id)
      .eq("organizationId", organizationId)
      .maybeSingle(),
  );
  if (!owned) return { count: 0 };

  const payload: Record<string, unknown> = { ...data };
  if (data.issueDate) payload.issueDate = data.issueDate.toISOString();
  if (data.dueDate) payload.dueDate = data.dueDate.toISOString();
  if (data.paidAt !== undefined) payload.paidAt = data.paidAt ? data.paidAt.toISOString() : null;

  unwrap<Row>(await supabase.from("invoices").update(payload).eq("id", id).select("id").single());
  return { count: 1 };
}

export async function deleteInvoice(organizationId: string, id: string): Promise<{ count: number }> {
  const rows = unwrap<Row[]>(
    await supabase
      .from("invoices")
      .delete()
      .eq("id", id)
      .eq("organizationId", organizationId)
      .select("id"),
  );
  return { count: rows?.length ?? 0 };
}

export async function findClientForOrg(organizationId: string, clientId: string): Promise<ClientRow | null> {
  const row = unwrap<Row | null>(
    await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("organizationId", organizationId)
      .maybeSingle(),
  );
  return row as ClientRow | null;
}

export { mapInvoice };
