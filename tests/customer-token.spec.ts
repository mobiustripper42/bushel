import { test, expect } from "@playwright/test";
import { query } from "@/lib/db";
import {
  TEST_CUSTOMERS,
  customerOrderUrl,
  resetCustomerOrderState,
} from "./helpers";

const COOKIE = "bbf_customer_token";

test.describe("/c/[token] route", () => {
  // /c/[token] renders an open order as the add-mode form (DEC-041); these
  // tests assert the fresh form rendered, so reset to keep them deterministic
  // regardless of spec ordering. #130 added a paused/closed shell that
  // short-circuits before the form, so we also normalise both account-state
  // flags here — otherwise a prior spec leaving send_weekly_link=false on a
  // seed customer turns every "renders the form" assertion in this file
  // into a paused-shell render.
  test.beforeEach(async () => {
    await resetCustomerOrderState();
    for (const token of [TEST_CUSTOMERS.farmStand.token, TEST_CUSTOMERS.restaurant.token]) {
      await query(
        `update customers set is_active = true, send_weekly_link = true where token = $1`,
        [token],
      );
    }
  });

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

  // #130 — admin-side account state gates the order form. Toggle each
  // flag on the seeded restaurant customer; assert the right shell
  // renders and the order form is gone. Restore flags after each path.
  test.describe("account-state shells", () => {
    test.afterEach(async () => {
      await query(
        `update customers set is_active = true, send_weekly_link = true where token = $1`,
        [TEST_CUSTOMERS.restaurant.token],
      );
    });

    test("send_weekly_link=false renders the paused shell", async ({ page }) => {
      await query(
        `update customers set send_weekly_link = false where token = $1`,
        [TEST_CUSTOMERS.restaurant.token],
      );

      await page.goto(customerOrderUrl(TEST_CUSTOMERS.restaurant.token));
      await expect(page.getByRole("heading", { name: /weekly order link is paused/i })).toBeVisible();
      await expect(page.getByText(/216-202-5718/)).toBeVisible();
      // Order form is absent.
      await expect(page.getByRole("heading", { name: /what.s available/i })).toHaveCount(0);
    });

    test("is_active=false renders the closed shell", async ({ page }) => {
      await query(
        `update customers set is_active = false where token = $1`,
        [TEST_CUSTOMERS.restaurant.token],
      );

      await page.goto(customerOrderUrl(TEST_CUSTOMERS.restaurant.token));
      await expect(page.getByRole("heading", { name: /account is closed/i })).toBeVisible();
      await expect(page.getByText(/come back/i)).toBeVisible();
      await expect(page.getByRole("heading", { name: /what.s available/i })).toHaveCount(0);
    });

    test("toggling back restores the order form", async ({ page }) => {
      await query(
        `update customers set send_weekly_link = false where token = $1`,
        [TEST_CUSTOMERS.restaurant.token],
      );
      await page.goto(customerOrderUrl(TEST_CUSTOMERS.restaurant.token));
      await expect(page.getByRole("heading", { name: /paused/i })).toBeVisible();

      await query(
        `update customers set send_weekly_link = true where token = $1`,
        [TEST_CUSTOMERS.restaurant.token],
      );
      await page.reload();
      await expect(page.getByRole("heading", { name: /what.s available/i })).toBeVisible();
    });
  });
});
