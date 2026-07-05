import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The admins table IS the allowlist (DEC-047): only listed emails can mint a
  // session, so a valid session subject is already an admin — no is_admin flag
  // to re-check. Proxy already gated /admin; this is the defense-in-depth read
  // (and drives the sliding-expiry cookie renewal).
  const user = await getAdminUser();
  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
