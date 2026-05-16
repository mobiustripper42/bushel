import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { ADMIN_STORAGE_STATE, TEST_CUSTOMERS, TEST_PRODUCTS } from "./helpers";
import { weekOfMondayNY } from "@/lib/week";
import {
  EXPORT_COLUMNS,
  ordersToRows,
  toCsv,
  toTsv,
} from "@/lib/admin/export-orders";
import type { OrderRow } from "@/lib/admin/orders-queries";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function customerIds(): Promise<{ farmStand: string; restaurant: string }> {
  const sb = admin();
  const { data, error } = await sb
    .from("customers")
    .select("id, token")
    .in("token", [TEST_CUSTOMERS.farmStand.token, TEST_CUSTOMERS.restaurant.token]);
  if (error || !data) throw new Error(`customerIds: ${error?.message ?? "no rows"}`);
  const map = new Map(data.map((r) => [r.token, r.id]));
  return {
    farmStand: map.get(TEST_CUSTOMERS.farmStand.token)!,
    restaurant: map.get(TEST_CUSTOMERS.restaurant.token)!,
  };
}

async function clearWeek(weekOf: string): Promise<void> {
  const sb = admin();
  const ids = await customerIds();
  await sb
    .from("orders")
    .delete()
    .in("customer_id", [ids.farmStand, ids.restaurant])
    .eq("week_of", weekOf);
}

type SeedOrderInput = {
  customerId: string;
  weekOf: string;
  fulfillmentType: "pickup" | "delivery";
  items: Array<{ productId: string; qty: number; unitPriceCents: number }>;
};

async function seedOrder(input: SeedOrderInput): Promise<string> {
  const sb = admin();
  const { data: order } = await sb
    .from("orders")
    .insert({
      customer_id: input.customerId,
      week_of: input.weekOf,
      fulfillment_type: input.fulfillmentType,
      status: "new",
    })
    .select("id")
    .single();
  await sb.from("order_items").insert(
    input.items.map((i) => ({
      order_id: order!.id,
      product_id: i.productId,
      qty: i.qty,
      unit_price_cents: i.unitPriceCents,
    })),
  );
  return order!.id;
}

// --- unit-style tests (no `page`) ----------------------------------------

function mockOrder(over: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "order-1",
    customerId: "cust-1",
    customerName: "Test Customer",
    placedAt: "2026-05-12T15:30:00Z",
    weekOf: "2026-05-11",
    fulfillmentType: "pickup",
    deliveryAddress: null,
    deliveryPreference: null,
    pickupNote: null,
    notes: null,
    status: "new",
    needsReconciliation: false,
    items: [
      {
        productId: "p1",
        name: "Kale",
        unit: "bunch",
        qty: 2,
        unitPriceCents: 300,
        qtyAvailable: 10,
      },
    ],
    totalCents: 600,
    ...over,
  };
}

test("toCsv: header + line item shape, RFC 4180 quoting", () => {
  const csv = toCsv([
    mockOrder({
      id: "abcdef123456789-abcd-0000-0000-000000000000",
      customerName: 'Bar Cento, Cleveland "Westside"',
      items: [
        {
          productId: "p1",
          name: "Heirloom\ntomatoes",
          unit: "lb",
          qty: 3,
          unitPriceCents: 550,
          qtyAvailable: 10,
        },
      ],
    }),
  ]);
  const lines = csv.split("\r\n");
  expect(lines[0]).toBe(EXPORT_COLUMNS.join(","));
  // Comma in customer name → quoted; embedded quotes doubled
  expect(lines[1]).toContain('"Bar Cento, Cleveland ""Westside"""');
  // Newline in item name → quoted with literal newline preserved
  expect(lines[1]).toContain('"Heirloom\ntomatoes"');
  // Invoice number is the first 12 chars of the order id (string slice)
  expect(lines[1].startsWith("abcdef123456,")).toBe(true);
  // Quantity + Unit Price columns follow Item Name
  expect(lines[1]).toContain(",3,5.50,lb,,");
});

test("toCsv: one row per line item; rows from the same order share an invoice number", () => {
  const csv = toCsv([
    mockOrder({
      id: "11111111-2222-3333-4444-555555555555",
      customerName: "A",
      items: [
        { productId: "p1", name: "Kale", unit: "bunch", qty: 1, unitPriceCents: 300, qtyAvailable: 5 },
        { productId: "p2", name: "Eggs", unit: "dozen", qty: 2, unitPriceCents: 600, qtyAvailable: 5 },
      ],
    }),
    mockOrder({
      id: "99999999-aaaa-bbbb-cccc-dddddddddddd",
      customerName: "B",
      items: [
        { productId: "p3", name: "Honey", unit: "jar", qty: 1, unitPriceCents: 1200, qtyAvailable: 5 },
      ],
    }),
  ]);
  const lines = csv.split("\r\n");
  expect(lines).toHaveLength(4); // header + 3 line items
  // slice(0, 12) of a standard UUID includes one hyphen (e.g. "11111111-222")
  expect(lines[1].startsWith("11111111-222,A,Kale,")).toBe(true);
  expect(lines[2].startsWith("11111111-222,A,Eggs,")).toBe(true);
  expect(lines[3].startsWith("99999999-aaa,B,Honey,")).toBe(true);
});

test("toCsv: empty orders → header only", () => {
  expect(toCsv([])).toBe(EXPORT_COLUMNS.join(","));
});

test("toTsv: tab-separated, strips embedded tabs/newlines from fields", () => {
  const tsv = toTsv([
    mockOrder({
      customerName: "Has\ttab",
      items: [
        {
          productId: "p1",
          name: "Has\nnewline",
          unit: "lb",
          qty: 1,
          unitPriceCents: 100,
          qtyAvailable: 5,
        },
      ],
    }),
  ]);
  const lines = tsv.split("\n");
  expect(lines[0]).toBe(EXPORT_COLUMNS.join("\t"));
  // Each line is one row — newline-in-field must NOT add extra lines
  expect(lines).toHaveLength(2);
  expect(lines[1]).toContain("Has tab");
  expect(lines[1]).toContain("Has newline");
});

test("ordersToRows: quantity + unit price; description = item.unit", () => {
  const rows = ordersToRows([
    mockOrder({
      items: [
        { productId: "p", name: "X", unit: "ea", qty: 7, unitPriceCents: 125, qtyAvailable: 10 },
      ],
    }),
  ]);
  expect(rows[0].quantity).toBe("7");
  expect(rows[0].unitPrice).toBe("1.25");
  expect(rows[0].description).toBe("ea");
  expect(rows[0].salesTaxes).toBe("");
  expect(rows[0].messages).toBe("");
});

// --- integration tests (admin page) --------------------------------------

test.describe("admin orders export — UI", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  const thisWeek = weekOfMondayNY();

  test.beforeEach(async () => {
    await clearWeek(thisWeek);
  });

  test.afterAll(async () => {
    await clearWeek(thisWeek);
  });

  test("Download CSV produces a file with the expected header + body", async ({ page }) => {
    const ids = await customerIds();
    await seedOrder({
      customerId: ids.farmStand,
      weekOf: thisWeek,
      fulfillmentType: "pickup",
      items: [
        { productId: TEST_PRODUCTS.kale.id, qty: 2, unitPriceCents: 300 },
      ],
    });

    await page.goto("/admin/orders");
    await page.getByRole("button", { name: /export to wave/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /download csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`bushel-orders-${thisWeek}.csv`);
    const stream = await download.createReadStream();
    let text = "";
    for await (const chunk of stream) text += chunk.toString();
    const lines = text.split("\r\n");
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","));
    expect(lines[1]).toContain(TEST_CUSTOMERS.farmStand.name);
    expect(lines[1]).toContain("Kale");
    // Quantity=2, Unit Price=3.00, Description=bunch
    expect(lines[1]).toContain(",2,3.00,bunch,,");
  });

  test("Copy as TSV writes to clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const ids = await customerIds();
    await seedOrder({
      customerId: ids.restaurant,
      weekOf: thisWeek,
      fulfillmentType: "delivery",
      items: [
        { productId: TEST_PRODUCTS.honey.id, qty: 1, unitPriceCents: 1200 },
      ],
    });

    await page.goto("/admin/orders");
    await page.getByRole("button", { name: /export to wave/i }).click();
    await page.getByRole("button", { name: /copy as tsv/i }).click();
    await expect(page.getByText(/copied to clipboard/i)).toBeVisible({ timeout: 3000 });

    const clip: string = await page.evaluate(() => navigator.clipboard.readText());
    const lines = clip.split("\n");
    expect(lines[0]).toBe(EXPORT_COLUMNS.join("\t"));
    expect(lines[1]).toContain(TEST_CUSTOMERS.restaurant.name);
    expect(lines[1]).toContain("Honey");
    expect(lines[1]).toContain("12.00");
    expect(lines[1]).toContain("jar"); // Description = unit
  });

  test("Export button disabled when no orders for the week", async ({ page }) => {
    await page.goto("/admin/orders");
    const btn = page.getByRole("button", { name: /export to wave/i });
    await expect(btn).toBeDisabled();
  });
});
