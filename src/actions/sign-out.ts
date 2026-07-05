"use server";

import { redirect } from "next/navigation";
import { endSession } from "@/lib/auth/session-cookie";

// Drops the local session cookie only (DEC-047). The token is stateless, so
// there's nothing server-side to revoke — signing out on the laptop leaves
// Annabel's phone session intact, and Playwright's shared storageState survives
// specs that run after admin-shell's sign-out test.
export async function signOut() {
  await endSession();
  redirect("/login");
}
