// Admin auth gate (DEC-047). Identity comes from the self-rolled HMAC session
// cookie (src/lib/auth). All call sites read `{ id }` — the admins.id UUID — and
// are unchanged from the Supabase-era shape.
import { readSubject } from "@/lib/auth/session-cookie";

export async function getAdminUser(): Promise<{ id: string } | null> {
  const subject = await readSubject();
  return subject ? { id: subject.id } : null;
}
