"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// scope: "local" — sign out this session only, not every session for the
// user. Default ("global") revokes the refresh token server-side, which is
// surprising for an operator UI (kicks Annabel out of her phone if she
// signs out on the laptop) and breaks Playwright's shared storageState
// across specs that run after admin-shell's sign-out test.
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    redirect("/login?error=signout_failed");
  }
  redirect("/login");
}
