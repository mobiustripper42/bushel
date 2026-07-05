import { chromium } from "@playwright/test";
import { mkdir } from "fs/promises";

import { query } from "@/lib/db";
import { signSession } from "@/lib/auth/session";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_TTL_MS,
  sessionSecret,
} from "@/lib/auth/config";

export const TEST_ADMIN_EMAIL = "test-admin@bushel.test";
// Fixed id so specs can assert on per-admin attribution deterministically. Not
// seeded by 0002 (that migration runs against prod) — upserted here only.
export const TEST_ADMIN_ID = "a0000000-0000-0000-0000-000000000001";

export const ADMIN_STORAGE_STATE_PATH = "playwright/.auth/admin.json";

// Mint the admin session cookie directly (DEC-047) and write a fresh
// storageState file. No email in the loop — the pure HMAC session is minted with
// the same SESSION_SECRET the app verifies with (CI sets it; dev/test share the
// insecure default). Extracted from globalSetup so the admin-shell sign-out test
// can rebuild the shared state after it clears the cookie, keeping later specs
// authenticated. (Exercising the real request→verify code path headlessly is
// 10.6; this deterministic mint is what keeps the suite green here.)
export async function writeAdminStorageState(): Promise<void> {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
  const hostname = new URL(baseURL).hostname;
  const secure = baseURL.startsWith("https://");

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const token = signSession(
    { subjectKind: "admin", subjectId: TEST_ADMIN_ID, expiresAt },
    sessionSecret(),
  );

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  await context.addCookies([
    {
      name: ADMIN_SESSION_COOKIE,
      value: token,
      domain: hostname,
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax" as const,
      expires: Math.floor(Date.parse(expiresAt) / 1000),
    },
  ]);
  await mkdir("playwright/.auth", { recursive: true });
  await context.storageState({ path: ADMIN_STORAGE_STATE_PATH });
  await browser.close();
}

export default async function globalSetup() {
  // ── Admin allowlist: upsert the test admin with its fixed id. The three real
  //    admins come from migration 0002; test-admin is test-only. ──
  await query(
    `insert into admins (id, email, name)
     values ($1, $2, 'Test Admin')
     on conflict (email) do update set id = excluded.id, name = excluded.name`,
    [TEST_ADMIN_ID, TEST_ADMIN_EMAIL],
  );

  // ── Data seeding targets the pg data DB (DATABASE_URL), the same database the
  //    app under test reads/writes. ──

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

  await writeAdminStorageState();
}
