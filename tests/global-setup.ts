import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "fs/promises";

export const TEST_ADMIN_EMAIL = "test-admin@bushel.test";
export const TEST_ADMIN_PASSWORD = "BushelTest1!";
const MAX_CHUNK_SIZE = 3180;

// Re-export the storage-state path so other tests/helpers can rebuild it.
export const ADMIN_STORAGE_STATE_PATH = "playwright/.auth/admin.json";

// Sign in the test admin and write a fresh storageState file. Extracted from
// globalSetup so the admin-shell sign-out test can refresh the shared state
// after it invalidates the session, keeping later specs (notifications-flow)
// authenticated. @supabase/ssr's getUser() on subsequent contexts otherwise
// rejects the post-signOut JWT even with scope:"local" — empirically observed.
export async function writeAdminStorageState(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`writeAdminStorageState sign-in failed: ${error?.message ?? "no session"}`);
  }

  const sessionCookies = sessionToCookies(data.session, storageKeyFromUrl(supabaseUrl));
  const hostname = new URL(baseURL).hostname;
  const secure = baseURL.startsWith("https://");

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
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
  await context.storageState({ path: ADMIN_STORAGE_STATE_PATH });
  await browser.close();
}

// @supabase/ssr v0.10+ derives the storage key from the project hostname:
// sb-<hostname[0]>-auth-token (e.g. sb-nnmfubmlvnkouxxfxxlh-auth-token for remote,
// sb-127-auth-token for local). Hard-coding "supabase.auth.token" breaks the lookup.
function storageKeyFromUrl(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

function sessionToCookies(
  session: object,
  storageKey: string,
): Array<{ name: string; value: string }> {
  const encoded =
    "base64-" +
    Buffer.from(JSON.stringify(session), "utf-8").toString("base64url");
  if (encoded.length <= MAX_CHUNK_SIZE) {
    return [{ name: storageKey, value: encoded }];
  }
  const chunks: Array<{ name: string; value: string }> = [];
  for (let i = 0, offset = 0; offset < encoded.length; i++, offset += MAX_CHUNK_SIZE) {
    chunks.push({
      name: `${storageKey}.${i}`,
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
    // User already exists — page through up to 1000 users to find them
    const { data: listData } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
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

  // Upsert test products so inventory tests are self-contained
  const { error: productsError } = await adminClient.from("products").upsert(
    [
      { id: "cccccccc-0000-0000-0000-000000000001", name: "Kale",  unit: "bunch", price_cents: 300,  qty_available: 10, is_available: true,  sort_order: 1 },
      { id: "cccccccc-0000-0000-0000-000000000002", name: "Eggs",  unit: "dozen", price_cents: 600,  qty_available: 5,  is_available: true,  sort_order: 2 },
      { id: "cccccccc-0000-0000-0000-000000000003", name: "Honey", unit: "jar",   price_cents: 1200, qty_available: 8,  is_available: true,  sort_order: 3 },
    ],
    { onConflict: "id" },
  );
  if (productsError)
    throw new Error(`products upsert failed: ${productsError.message}`);

  // Upsert test customers so customer-CRUD + prepopulate tests are self-contained.
  // is_active defaults true; tests that deactivate must reset to true.
  const { error: customersError } = await adminClient.from("customers").upsert(
    [
      { name: "Test Farm Stand", token: "testtoken-farmstand-0001",  is_active: true, send_weekly_link: true, priority: 100, business_name: null, email: null, phone: null, delivery_address: "100 Farm Stand Way, Lakewood, OH 44107" },
      { name: "Test Restaurant", token: "testtoken-restaurant-0001", is_active: true, send_weekly_link: true, priority: 100, business_name: null, email: null, phone: null, delivery_address: "200 Restaurant Row, Cleveland, OH 44102" },
    ],
    { onConflict: "token" },
  );
  if (customersError)
    throw new Error(`customers upsert failed: ${customersError.message}`);

  // Seed a prior delivery order for Test Farm Stand so 3.4 delivery_preference
  // prefill is testable. week_of is in the past so it doesn't collide with the
  // current week's order in 3.5+ tests. unique (customer_id, week_of) → upsert.
  const { data: farmStandRow, error: lookupError } = await adminClient
    .from("customers")
    .select("id")
    .eq("token", "testtoken-farmstand-0001")
    .single();
  if (lookupError || !farmStandRow)
    throw new Error(`farm stand lookup failed: ${lookupError?.message ?? "no row"}`);

  const { error: priorOrderError } = await adminClient.from("orders").upsert(
    [
      {
        customer_id: farmStandRow.id,
        week_of: "2026-04-27",
        fulfillment_type: "delivery",
        delivery_address: "100 Farm Stand Way, Lakewood, OH 44107",
        delivery_preference: "Back door, gate code 4321",
        status: "delivered",
        notes: null,
        pickup_note: null,
      },
    ],
    { onConflict: "customer_id,week_of" },
  );
  if (priorOrderError)
    throw new Error(`prior order upsert failed: ${priorOrderError.message}`);

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
  const sessionCookies = sessionToCookies(signInData.session, storageKeyFromUrl(supabaseUrl));
  const hostname = new URL(baseURL).hostname;
  const secure = baseURL.startsWith("https://");

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });

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
