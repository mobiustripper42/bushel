// Transitional admin auth gate. Until DEC-047's email-code session lands
// (task 10.3), admin identity still comes from Supabase Auth cookies — but
// data access moved to pg (task 10.2), so this is the ONLY thing the
// supabase server client is still used for in actions. 10.3 swaps this
// body for the HMAC-session check; call sites stay put.
import { createClient } from "@/lib/supabase/server";

export async function getAdminUser(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}
