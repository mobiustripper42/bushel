import { test, expect } from "@playwright/test";

import {
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  customerIds,
  clearOrdersForWeek,
  seedOrder,
} from "./helpers";
import { query } from "@/lib/db";
import { weekOfMondayNY } from "@/lib/week";

// #195 — public Harvest & Pack Sheet at /f/[token]. Read-only rollup over the
// week's orders. Runs on desktop + mobile (farm hands view it on phones).

async function fulfillmentToken(): Promise<string> {
  const rows = await query<{ token: string }>(
    `select token from fulfillment_link`,
  );
  if (!rows[0]) throw new Error("fulfillment token: no row");
  return rows[0].token;
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
  const kaleRow = page.locator(".fr-hv-line", { hasText: "Kale" });
  await expect(kaleRow.locator(".fr-hv-qty")).toHaveText("5");

  // Honey ordered once.
  const honeyRow = page.locator(".fr-hv-line", { hasText: "Honey" });
  await expect(honeyRow.locator(".fr-hv-qty")).toHaveText("1");
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

test("excludes picked_up / delivered orders (#200)", async ({ page }) => {
  const ids = await customerIds();
  // The restaurant's (delivery) order is fulfilled — out the door.
  await query(
    `update orders set status = 'delivered' where customer_id = $1 and week_of = $2`,
    [ids.restaurant, WEEK],
  );

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
      page.locator(".fr-hv-line", { hasText: "Kale" }).locator(".fr-hv-qty"),
    ).toHaveText("3");
    await expect(page.locator(".fr-hv-line", { hasText: "Honey" })).toHaveCount(0);
  } finally {
    await query(
      `update orders set status = 'new' where customer_id = $1 and week_of = $2`,
      [ids.restaurant, WEEK],
    );
  }
});

// DEC-041/DEC-042 (#227): the sheet is status-keyed, not week-keyed — an open
// order that crosses a week boundary keeps printing until it's out the door.
test("shows open orders from past weeks", async ({ page }) => {
  const ids = await customerIds();
  const [y, m, d] = WEEK.split("-").map((n) => parseInt(n, 10));
  const lastMonday = new Date(Date.UTC(y, m - 1, d - 7)).toISOString().slice(0, 10);
  // Re-stamp the farm stand's open order into LAST week (update, not insert —
  // the partial unique index allows only one open order per customer).
  await query(
    `update orders set week_of = $1 where customer_id = $2 and week_of = $3`,
    [lastMonday, ids.farmStand, WEEK],
  );

  try {
    await page.goto(`/f/${await fulfillmentToken()}`);
    await expect(
      page.locator(".fr-slip", { hasText: TEST_CUSTOMERS.farmStand.name }),
    ).toHaveCount(1);
    // Its items still roll into the harvest totals (Kale 3 + restaurant's 2).
    await expect(
      page.locator(".fr-hv-line", { hasText: "Kale" }).locator(".fr-hv-qty"),
    ).toHaveText("5");
  } finally {
    await query(
      `update orders set week_of = $1 where customer_id = $2 and week_of = $3`,
      [WEEK, ids.farmStand, lastMonday],
    );
  }
});
