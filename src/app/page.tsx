import { redirect } from "next/navigation";

// The bare domain has no customer-facing purpose — customers arrive at
// /c/<token> via the weekly SMS link, never at /. Anyone hitting the root
// is Annabel (or a curious clicker on a bookmark); send them to admin.
// The proxy will bounce unauthenticated traffic to /login?next=/admin.
export default function Home() {
  redirect("/admin");
}
