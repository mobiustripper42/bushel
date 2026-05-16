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
        description: "KALE-BUNCH",
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
      customerName: 'Bar Cento, Cleveland "Westside"',
      items: [
        {
          productId: "p1",
          name: "Heirloom\ntomatoes",
          description: "HEIRLOOM-LB",
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
  // Newline in product name (now the Description column) → quoted, preserved
  expect(lines[1]).toContain('"Heirloom\ntomatoes"');
  // Item Number column carries the slug
  expect(lines[1]).toContain(",HEIRLOOM-LB,3,5.50,");
});

test("toCsv: empty Item Number when product description (slug) is null", () => {
  const csv = toCsv([
    mockOrder({
      customerName: "Plum Café",
      items: [
        {
          productId: "p1",
          name: "Garlic scapes",
          description: null,
          unit: "bunch",
          qty: 4,
          unitPriceCents: 400,
          qtyAvailable: 10,
        },
      ],
    }),
  ]);
  const lines = csv.split("\r\n");
  // Customer Name, then empty Item Number (",,"), then Quantity, Unit Price, ...
  expect(lines[1]).toBe("Plum Café,,4,4.00,Garlic scapes,,");
});

test("toCsv: one row per line item; multi-item order keeps per-line slugs", () => {
  const csv = toCsv([
    mockOrder({
      customerName: "A",
      items: [
        { productId: "p1", name: "Kale", description: "KALE-BU", unit: "bunch", qty: 1, unitPriceCents: 300, qtyAvailable: 5 },
        { productId: "p2", name: "Eggs", description: "EGG-DZ", unit: "dozen", qty: 2, unitPriceCents: 600, qtyAvailable: 5 },
      ],
    }),
    mockOrder({
      customerName: "B",
      items: [
        { productId: "p3", name: "Honey", description: "HON-JAR", unit: "jar", qty: 1, unitPriceCents: 1200, qtyAvailable: 5 },
      ],
    }),
  ]);
  const lines = csv.split("\r\n");
  expect(lines).toHaveLength(4); // header + 3 line items
  expect(lines[1]).toBe("A,KALE-BU,1,3.00,Kale,,");
  expect(lines[2]).toBe("A,EGG-DZ,2,6.00,Eggs,,");
  expect(lines[3]).toBe("B,HON-JAR,1,12.00,Honey,,");
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
          description: "SLUG-WITH\nNEWLINE",
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
  expect(lines[1]).toContain("SLUG-WITH NEWLINE");
});

test("ordersToRows: itemNumber = product description (slug); description = product name", () => {
  const rows = ordersToRows([
    mockOrder({
      items: [
        { productId: "p", name: "Honey", description: "HONEY-JAR", unit: "jar", qty: 7, unitPriceCents: 125, qtyAvailable: 10 },
      ],
    }),
  ]);
  expect(rows[0].itemNumber).toBe("HONEY-JAR");
  expect(rows[0].description).toBe("Honey");
  expect(rows[0].quantity).toBe("7");
  expect(rows[0].unitPrice).toBe("1.25");
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

  // Set a product slug for the download test so we exercise the non-empty
  // Item Number path. Restored in afterEach.
  async function setProductSlug(productId: string, slug: string | null): Promise<void> {
    await admin().from("products").update({ description: slug }).eq("id", productId);
  }

  test.afterEach(async () => {
    // Restore seed shape — description is null for all TEST_PRODUCTS in seed.
    await setProductSlug(TEST_PRODUCTS.kale.id, null);
    await setProductSlug(TEST_PRODUCTS.honey.id, null);
  });

  test("Download CSV produces a file with the expected header + body", async ({ page }) => {
    const ids = await customerIds();
    await setProductSlug(TEST_PRODUCTS.kale.id, "KALE-BU");
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
    // Customer Name, Item Number (=slug), Quantity, Unit Price, Description (=name), ...
    const line = lines.find((l) => l.includes(TEST_CUSTOMERS.farmStand.name));
    expect(line).toBe(`${TEST_CUSTOMERS.farmStand.name},KALE-BU,2,3.00,Kale,,`);
  });

  test("Copy as TSV writes to clipboard; empty Item Number when slug is null", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const ids = await customerIds();
    // Honey has no slug (seed default) — assert the Item Number cell is empty.
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
    const line = lines.find((l) => l.includes(TEST_CUSTOMERS.restaurant.name));
    // Tab-separated: Customer, '', 1, 12.00, Honey, '', ''
    expect(line).toBe(`${TEST_CUSTOMERS.restaurant.name}\t\t1\t12.00\tHoney\t\t`);
  });

  test("Export button disabled when no orders for the week", async ({ page }) => {
    await page.goto("/admin/orders");
    const btn = page.getByRole("button", { name: /export to wave/i });
    await expect(btn).toBeDisabled();
  });
});
