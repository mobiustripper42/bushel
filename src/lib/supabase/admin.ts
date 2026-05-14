import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Service-role client. Bypasses RLS (DEC: service-role-as-gate + RLS-as-backstop).
// Use only on the server — never expose the service role key to the client.
// Uses `supabase-js` directly (not `@supabase/ssr`) — service role doesn't
// need cookie/session plumbing.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
