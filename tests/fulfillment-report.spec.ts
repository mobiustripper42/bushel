import { test, expect } from "@playwright/test";

import {
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  admin,
  customerIds,
  clearOrdersForWeek,
  seedOrder,
} from "./helpers";
import { weekOfMondayNY } from "@/lib/week";

// #195 — public Harvest & Pack Sheet at /f/[token]. Read-only rollup over the
// week's orders. Runs on desktop + mobile (farm hands view it on phones).

async function fulfillmentToken(): Promise<string> {
  const sb = admin();
  const { data, error } = await sb
    .from("fulfillment_link")
    .select("token")
    .single();
  if (error || !data) throw new Error(`fulfillment token: ${error?.message}`);
  return data.token;
}

const WEEK = weekOfMondayNY();

test.beforeAll(async () => {
  await clearOrdersForWeek(WEEK);
  const ids = await customerIds();
  // Farm stand (pickup): Kale 3, Eggs 2.
  await seedOrder({
    customerId: ids.farmStand,
    weekOf: WEEK,
    fulfillmentType: "pickup",
    items: [
      { productId: TEST_PRODUCTS.kale.id, qty: 3, unitPriceCents: TEST_PRODUCTS.kale.price_cents },
      { productId: TEST_PRODUCTS.eggs.id, qty: 2, unitPriceCents: TEST_PRODUCTS.eggs.price_cents },
    ],
  });
  // Restaurant (delivery): Kale 2, Honey 1. → harvest Kale total = 5.
  await seedOrder({
    customerId: ids.restaurant,
    weekOf: WEEK,
    fulfillmentType: "delivery",
    items: [
      { productId: TEST_PRODUCTS.kale.id, qty: 2, unitPriceCents: TEST_PRODUCTS.kale.price_cents },
      { productId: TEST_PRODUCTS.honey.id, qty: 1, unitPriceCents: TEST_PRODUCTS.honey.price_cents },
    ],
  });
});

test.afterAll(async () => {
  await clearOrdersForWeek(WEEK);
});

test("harvest list consolidates quantities across orders", async ({ page }) => {
  await page.goto(`/f/${await fulfillmentToken()}`);

  await expect(page.locator(".fr-report")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harvest & Pack Sheet" })).toBeVisible();

  // Kale ordered by both customers (3 + 2) → summed to 5.
  const kaleRow = page.locator(".fr-hv-row", { hasText: "Kale" });
  await expect(kaleRow.locator(".fr-hv-unit-qty")).toHaveText("5");

  // Honey ordered once.
  const honeyRow = page.locator(".fr-hv-row", { hasText: "Honey" });
  await expect(honeyRow.locator(".fr-hv-unit-qty")).toHaveText("1");
});

test("packing slips list each order with its fulfillment type", async ({ page }) => {
  await page.goto(`/f/${await fulfillmentToken()}`);

  const farmSlip = page.locator(".fr-slip", { hasText: TEST_CUSTOMERS.farmStand.name });
  await expect(farmSlip).toContainText("Pickup");
  await expect(farmSlip).toContainText("Kale");
  await expect(farmSlip).toContainText("Eggs");

  const restaurantSlip = page.locator(".fr-slip", { hasText: TEST_CUSTOMERS.restaurant.name });
  await expect(restaurantSlip).toContainText("Delivery");
  await expect(restaurantSlip).toContainText("Honey");
});

test("invalid token 404s", async ({ page }) => {
  const res = await page.goto("/f/not-a-real-token-9999");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("This link doesn’t work.")).toBeVisible();
});

test("excludes picked-up / delivered orders (#200)", async ({ page }) => {
  const ids = await customerIds();
  const sb = admin();
  // The restaurant's (delivery) order is fulfilled — out the door.
  await sb
    .from("orders")
    .update({ status: "delivered" })
    .eq("customer_id", ids.restaurant)
    .eq("week_of", WEEK);

  try {
    await page.goto(`/f/${await fulfillmentToken()}`);

    // Restaurant slip is gone; the still-active farm-stand slip remains.
    await expect(
      page.locator(".fr-slip", { hasText: TEST_CUSTOMERS.restaurant.name }),
    ).toHaveCount(0);
    await expect(
      page.locator(".fr-slip", { hasText: TEST_CUSTOMERS.farmStand.name }),
    ).toHaveCount(1);

    // Kale drops 5 → 3 (restaurant's 2 excluded); Honey (restaurant-only) gone.
    await expect(
      page.locator(".fr-hv-row", { hasText: "Kale" }).locator(".fr-hv-unit-qty"),
    ).toHaveText("3");
    await expect(page.locator(".fr-hv-row", { hasText: "Honey" })).toHaveCount(0);
  } finally {
    await sb
      .from("orders")
      .update({ status: "new" })
      .eq("customer_id", ids.restaurant)
      .eq("week_of", WEEK);
  }
});
