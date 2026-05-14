import { test, expect } from "@playwright/test";
import { TEST_CUSTOMERS, customerOrderUrl } from "./helpers";

const COOKIE = "bbf_customer_token";

test.describe("/c/[token] route", () => {
  test("valid token renders the page and sets the cookie", async ({ page, context }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await expect(page.getByRole("heading", { name: /What.s available/i })).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === COOKIE);
    expect(cookie?.value).toBe(TEST_CUSTOMERS.farmStand.token);
  });

  test("invalid token 404s and does not set the cookie", async ({ page, context }) => {
    const response = await page.goto(customerOrderUrl("not-a-real-token"));
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/This link doesn.t work anymore/i)).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === COOKIE);
    expect(cookie).toBeUndefined();
  });

  test("cookie persists across reloads", async ({ page, context }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await page.reload();
    const cookie = (await context.cookies()).find((c) => c.name === COOKIE);
    expect(cookie?.value).toBe(TEST_CUSTOMERS.farmStand.token);
  });

  test("visiting a second customer overwrites the cookie (no cross-customer leak)", async ({
    page,
    context,
  }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    let cookie = (await context.cookies()).find((c) => c.name === COOKIE);
    expect(cookie?.value).toBe(TEST_CUSTOMERS.farmStand.token);

    await page.goto(customerOrderUrl(TEST_CUSTOMERS.restaurant.token));
    cookie = (await context.cookies()).find((c) => c.name === COOKIE);
    expect(cookie?.value).toBe(TEST_CUSTOMERS.restaurant.token);
  });
});
