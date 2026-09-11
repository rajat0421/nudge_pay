import { supabase, unwrap, type Row } from "../../db/supabase";

/**
 * Kept separate from auth.repository, which owns credential-related queries
 * (password hash, refresh tokens). Other modules that only need to display a
 * user's name (audit trail, activity feed) should use this instead.
 */
export async function findUserById(id: string) {
  return unwrap<Row | null>(
    await supabase
      .from("users")
      .select("id, email, firstName, lastName")
      .eq("id", id)
      .maybeSingle(),
  );
}
