import { supabase, unwrap, type Row } from "../../db/supabase";
import { mapOrganization, type OrganizationRow } from "../../db/mappers";

export async function getOrganizationById(id: string): Promise<OrganizationRow | null> {
  const row = unwrap<Row | null>(
    await supabase.from("organizations").select("*").eq("id", id).maybeSingle(),
  );
  return row && mapOrganization(row);
}

export interface UpdateOrganizationData {
  name?: string;
  timezone?: string;
  currency?: string;
}

export async function updateOrganization(
  id: string,
  data: UpdateOrganizationData,
): Promise<OrganizationRow> {
  const row = unwrap<Row>(
    await supabase.from("organizations").update(data).eq("id", id).select().single(),
  );
  return mapOrganization(row);
}
