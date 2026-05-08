import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Proxy already called getUser() for session refresh — this is the second call per request.
  const { data: profile, error } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (error) {
    redirect("/login?error=auth_error");
  }

  if (!profile?.is_admin) {
    redirect("/");
  }

  return <>{children}</>;
}
