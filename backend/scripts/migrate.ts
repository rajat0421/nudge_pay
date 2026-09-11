/* eslint-disable no-console */
/**
 * Minimal migration runner — applies supabase/migrations/*.sql, in filename
 * order, against DIRECT_URL, tracking what's already been applied in a
 * `_migrations` table. This is the ONLY place in the backend that opens a
 * direct Postgres connection: PostgREST (what @supabase/supabase-js talks to
 * at runtime) can't execute DDL, so schema changes have to go through here
 * instead. The running app never imports `pg` or reads DIRECT_URL.
 *
 * Usage: npm run db:migrate
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

async function main() {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    throw new Error("DIRECT_URL is required to run migrations (direct, non-pooled Postgres connection).");
  }

  const client = new Client({ connectionString: directUrl });
  await client.connect();

  try {
    await client.query(`
      create table if not exists _migrations (
        name text primary key,
        "appliedAt" timestamptz not null default now()
      )
    `);

    const { rows: applied } = await client.query<{ name: string }>('select name from _migrations');
    const appliedNames = new Set(applied.map((row) => row.name));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    let ranCount = 0;

    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`  skip   ${file} (already applied)`);
        continue;
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      console.log(`  apply  ${file}`);

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into _migrations (name) values ($1)", [file]);
        await client.query("commit");
        ranCount += 1;
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
      }
    }

    console.log(ranCount === 0 ? "Nothing to apply — already up to date." : `Applied ${ranCount} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
