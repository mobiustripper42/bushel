import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "fs/promises";

export const TEST_ADMIN_EMAIL = "test-admin@bushel.test";
const TEST_ADMIN_PASSWORD = "BushelTest1!";
const AUTH_STORAGE_KEY = "supabase.auth.token";
const MAX_CHUNK_SIZE = 3180;

function sessionToCookies(
  session: object,
): Array<{ name: string; value: string }> {
  const encoded =
    "base64-" +
    Buffer.from(JSON.stringify(session), "utf-8").toString("base64url");
  if (encoded.length <= MAX_CHUNK_SIZE) {
    return [{ name: AUTH_STORAGE_KEY, value: encoded }];
  }
  const chunks: Array<{ name: string; value: string }> = [];
  for (let i = 0, offset = 0; offset < encoded.length; i++, offset += MAX_CHUNK_SIZE) {
    chunks.push({
      name: `${AUTH_STORAGE_KEY}.${i}`,
      value: encoded.slice(offset, offset + MAX_CHUNK_SIZE),
    });
  }
  return chunks;
}

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error(
      "Missing Supabase env vars for test setup.\n" +
        "Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY\n" +
        "For local dev: add SUPABASE_SERVICE_ROLE_KEY to .envrc or your shell before running tests.",
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create test admin user — if already exists, the error is benign
  let userId: string | undefined;
  const { data: createData } = await adminClient.auth.admin.createUser({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD,
    email_confirm: true,
  });
  userId = createData?.user?.id;

  if (!userId) {
    const { data: listData } = await adminClient.auth.admin.listUsers({
      perPage: 100,
    });
    userId = listData?.users?.find((u) => u.email === TEST_ADMIN_EMAIL)?.id;
  }
  if (!userId) throw new Error("Could not create or find test admin user");

  // Ensure public.users row with is_admin = true (service role bypasses RLS)
  const { error: upsertError } = await adminClient
    .from("users")
    .upsert({ id: userId, is_admin: true }, { onConflict: "id" });
  if (upsertError)
    throw new Error(`public.users upsert failed: ${upsertError.message}`);

  // Sign in to get a real, server-verified session
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signInData, error: signInError } =
    await anonClient.auth.signInWithPassword({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
    });
  if (signInError || !signInData.session) {
    throw new Error(
      `Test admin sign-in failed: ${signInError?.message ?? "no session returned"}`,
    );
  }

  // Inject session into browser context via @supabase/ssr cookie format
  const sessionCookies = sessionToCookies(signInData.session);
  const hostname = new URL(baseURL).hostname;
  const secure = baseURL.startsWith("https://");

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/");

  await context.addCookies(
    sessionCookies.map(({ name, value }) => ({
      name,
      value,
      domain: hostname,
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "Lax" as const,
    })),
  );

  await mkdir("playwright/.auth", { recursive: true });
  await context.storageState({ path: "playwright/.auth/admin.json" });
  await browser.close();
}
