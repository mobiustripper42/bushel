import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "fs/promises";

import { query } from "@/lib/db";

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

  // Ensure public.users row with is_admin = true. This lives in the SUPABASE
  // (auth) database, not the pg data DB — Supabase Auth remains the admin
  // login until DEC-047 lands (10.3).
  const { error: upsertError } = await adminClient
    .from("users")
    .upsert({ id: userId, is_admin: true }, { onConflict: "id" });
  if (upsertError)
    throw new Error(`public.users upsert failed: ${upsertError.message}`);

  // ── Data seeding below targets the pg data DB (DATABASE_URL), the same
  //    database the app under test reads/writes (task 10.2). ──

  // Upsert test products so inventory tests are self-contained
  await query(
    `insert into products (id, name, qty_available, is_available, sort_order)
     values
       ('cccccccc-0000-0000-0000-000000000001', 'Kale',  10, true, 1),
       ('cccccccc-0000-0000-0000-000000000002', 'Eggs',   5, true, 2),
       ('cccccccc-0000-0000-0000-000000000003', 'Honey',  8, true, 3)
     on conflict (id) do update
       set name = excluded.name, qty_available = excluded.qty_available,
           is_available = excluded.is_available, sort_order = excluded.sort_order`,
  );

  // DEC-037: unit label + price live on the base product_units row and nothing
  // auto-spawns it — upsert the base rows alongside the products. Keyed on
  // (product_id, label) so a price drifted by a prior run is restored without
  // colliding with leftover extra units (specs reset those via
  // resetProductUnits / setProductUnits).
  await query(
    `insert into product_units
       (product_id, label, conversion_to_base, unit_price_cents, is_active, sort_order, slug)
     values
       ('cccccccc-0000-0000-0000-000000000001', 'bunch', 1, 300,  true, 0, 'kale-cccccccc'),
       ('cccccccc-0000-0000-0000-000000000002', 'dozen', 1, 600,  true, 0, 'eggs-cccccccc'),
       ('cccccccc-0000-0000-0000-000000000003', 'jar',   1, 1200, true, 0, 'honey-cccccccc')
     on conflict (product_id, label) do update
       set conversion_to_base = excluded.conversion_to_base,
           unit_price_cents = excluded.unit_price_cents,
           is_active = excluded.is_active,
           sort_order = excluded.sort_order,
           slug = excluded.slug`,
  );

  // Upsert test customers so customer-CRUD tests are self-contained.
  // is_active defaults true; tests that deactivate must reset to true.
  await query(
    `insert into customers
       (name, token, is_active, send_weekly_link, priority, delivery_address)
     values
       ('Test Farm Stand', 'testtoken-farmstand-0001', true, true, 100,
        '100 Farm Stand Way, Lakewood, OH 44107'),
       ('Test Restaurant', 'testtoken-restaurant-0001', true, true, 100,
        '200 Restaurant Row, Cleveland, OH 44102')
     on conflict (token) do update
       set name = excluded.name, is_active = excluded.is_active,
           send_weekly_link = excluded.send_weekly_link,
           priority = excluded.priority,
           delivery_address = excluded.delivery_address`,
  );

  // Seed a prior delivery order for Test Farm Stand so 3.4 delivery_preference
  // prefill is testable. week_of is in the past and status terminal so it
  // neither collides with current-week tests nor occupies the open-order
  // identity (DEC-041 dropped unique (customer_id, week_of), so this is a
  // check-then-insert rather than an upsert).
  //
  // Deliberately ITEMLESS: it appears in the admin Fulfilled view (DEC-045),
  // and orders-flow's "export respects the active view" test relies on it
  // emitting zero CSV rows (export is per line item). Adding items here
  // breaks that spec's not-toContain assertions.
  await query(
    `insert into orders
       (customer_id, week_of, fulfillment_type, delivery_address,
        delivery_preference, status)
     select id, '2026-04-27', 'delivery',
            '100 Farm Stand Way, Lakewood, OH 44107',
            'Back door, gate code 4321', 'delivered'
       from customers
      where token = 'testtoken-farmstand-0001'
        and not exists (
          select 1 from orders o
           where o.customer_id = customers.id and o.week_of = '2026-04-27'
        )`,
  );

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
