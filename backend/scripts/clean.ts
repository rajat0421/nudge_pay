/* eslint-disable no-console */
/**
 * Wipes every row from every NudgePay table — including whatever the seed
 * script created. Destructive and irreversible: it truncates the live
 * database SUPABASE_URL points at. There is no confirmation prompt — think
 * before running this against anything other than a database you intend to
 * empty.
 *
 * Usage: npm run db:clean
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

async function main() {
  console.log("Wiping all NudgePay data from the database...");
  const { error } = await supabase.rpc("truncate_all_tables");
  if (error) throw new Error(error.message);
  console.log("Done — every table is now empty.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
