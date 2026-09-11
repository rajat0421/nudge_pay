import { supabase } from "../../src/db/supabase";

/** Wipes all tables between tests. Safe because tests run against a dedicated test database. */
export async function resetDatabase(): Promise<void> {
  const { error } = await supabase.rpc("truncate_all_tables");
  if (error) throw new Error(error.message);
}
