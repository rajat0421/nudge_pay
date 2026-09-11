import { supabase, unwrap, type Row } from "../../db/supabase";
import { mapInvoiceWithClient, mapReminderEventWithStep } from "../../db/mappers";

interface SummaryAggregates {
  outstandingAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
  totalInvoices: number;
  overdueCount: number;
}

export async function getSummaryAggregates(organizationId: string) {
  const aggregates = unwrap<SummaryAggregates>(
    await supabase.rpc("get_dashboard_summary", { p_organization_id: organizationId }),
  );

  const upcomingRows = unwrap<Row[]>(
    await supabase
      .from("invoices")
      .select("*, client:clients(*)")
      .eq("organizationId", organizationId)
      .in("status", ["SENT", "DUE"])
      .order("dueDate", { ascending: true })
      .limit(5),
  );

  return {
    ...aggregates,
    upcoming: (upcomingRows ?? []).map(mapInvoiceWithClient),
  };
}

export async function listOverdueInvoices(organizationId: string, opts: { skip: number; take: number }) {
  const rows = unwrap<Row[]>(
    await supabase
      .from("invoices")
      .select("*, client:clients(*)")
      .eq("organizationId", organizationId)
      .eq("status", "OVERDUE")
      .order("dueDate", { ascending: true })
      .range(opts.skip, opts.skip + opts.take - 1),
  );
  return (rows ?? []).map(mapInvoiceWithClient);
}

export async function countOverdueInvoices(organizationId: string): Promise<number> {
  const { count, error } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("organizationId", organizationId)
    .eq("status", "OVERDUE");
  if (error) throw error;
  return count ?? 0;
}

export async function listRecentActivity(organizationId: string, opts: { skip: number; take: number }) {
  const rows = unwrap<Row[]>(
    await supabase
      .from("reminder_events")
      .select("*, invoice:invoices(*, client:clients(*)), reminderStep:reminder_steps(*)")
      .eq("organizationId", organizationId)
      .in("status", ["SENT", "FAILED"])
      .order("updatedAt", { ascending: false })
      .range(opts.skip, opts.skip + opts.take - 1),
  );
  return (rows ?? []).map((row) => ({
    ...mapReminderEventWithStep(row),
    invoice: mapInvoiceWithClient(row.invoice as Row),
  }));
}

export async function countRecentActivity(organizationId: string): Promise<number> {
  const { count, error } = await supabase
    .from("reminder_events")
    .select("*", { count: "exact", head: true })
    .eq("organizationId", organizationId)
    .in("status", ["SENT", "FAILED"]);
  if (error) throw error;
  return count ?? 0;
}
