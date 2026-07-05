import { test, expect } from "@playwright/test";
import { query } from "@/lib/db";
import { hashCode } from "@/lib/auth/login-code";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_ID } from "./global-setup";

// Email-code admin auth (DEC-047). Only the code's sha256 hash is ever stored,
// so a headless test can't read the emailed plaintext. Instead these drive the
// real request action (step 1) to mint + set the pending-email cookie, then
// OVERWRITE the stored hash with a known code — simulating "the code that
// landed in the inbox" — before verifying (step 2). The reusable headless
// helper is 10.6; this proves the flow end-to-end here.

const KNOWN_CODE = "123456";

async function resetLoginCode(): Promise<void> {
  await query(
    `delete from login_codes where subject_kind = 'admin' and subject_id = $1`,
    [TEST_ADMIN_ID],
  );
}

// Force the test admin's stored code to a known value + freshness.
async function setStoredCode(code: string, expiresSql: string): Promise<void> {
  await query(
    `update login_codes
        set code_hash = $2, expires_at = ${expiresSql}, attempts = 0, consumed_at = null
      where subject_kind = 'admin' and subject_id = $1`,
    [TEST_ADMIN_ID, hashCode(code)],
  );
}

test.describe("admin route guard", () => {
  test("unauthenticated /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirect preserves ?next param", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/[?&]next=%2Fadmin/);
  });

  test("login page shows the email request form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder(/you@example/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /email me a code/i })).toBeVisible();
  });
});

test.describe("email-code login flow", () => {
  test.beforeEach(resetLoginCode);

  // Step 1: enter email → land on the code screen (generic no-enumeration copy).
  async function requestCodeFor(
    page: import("@playwright/test").Page,
    email: string,
  ) {
    await page.goto("/login");
    await page.getByPlaceholder(/you@example/i).fill(email);
    await page.getByRole("button", { name: /email me a code/i }).click();
    await expect(page).toHaveURL(/[?&]step=code/);
    await expect(page.getByPlaceholder("123456")).toBeVisible();
  }

  test("valid email + correct code signs in and lands on /admin", async ({ page }) => {
    await requestCodeFor(page, TEST_ADMIN_EMAIL);
    await setStoredCode(KNOWN_CODE, "now() + interval '10 minutes'");

    await page.getByPlaceholder("123456").fill(KNOWN_CODE);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("navigation", { name: /admin navigation/i })).toBeVisible();
  });

  test("unknown email still shows the code screen (no enumeration)", async ({ page }) => {
    await requestCodeFor(page, "stranger@nope.test");
    // Identical UI to a match; nothing reveals that the email wasn't registered.
    await expect(page.getByPlaceholder("123456")).toBeVisible();
  });

  test("wrong code is rejected and counts toward the lockout", async ({ page }) => {
    await requestCodeFor(page, TEST_ADMIN_EMAIL);
    await setStoredCode(KNOWN_CODE, "now() + interval '10 minutes'");

    await page.getByPlaceholder("123456").fill("000000");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText(/isn't right/i)).toBeVisible();

    const [{ attempts }] = await query<{ attempts: number }>(
      `select attempts from login_codes where subject_kind='admin' and subject_id=$1`,
      [TEST_ADMIN_ID],
    );
    expect(attempts).toBe(1);
  });

  test("the 5th wrong attempt locks — even the right code can't redeem", async ({ page }) => {
    await requestCodeFor(page, TEST_ADMIN_EMAIL);
    await setStoredCode(KNOWN_CODE, "now() + interval '10 minutes'");
    // Sit at the boundary: 4 failures already banked, so the next wrong guess
    // trips the cap. (Deterministic — avoids racing 5 form redirects in a row.)
    await query(
      `update login_codes set attempts = 4 where subject_kind='admin' and subject_id=$1`,
      [TEST_ADMIN_ID],
    );

    await page.getByPlaceholder("123456").fill("000000");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText(/too many attempts/i)).toBeVisible();

    // The correct code is now dead too.
    await page.getByPlaceholder("123456").fill(KNOWN_CODE);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText(/too many attempts/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("an expired code is refused", async ({ page }) => {
    await requestCodeFor(page, TEST_ADMIN_EMAIL);
    await setStoredCode(KNOWN_CODE, "now() - interval '1 minute'");

    await page.getByPlaceholder("123456").fill(KNOWN_CODE);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText(/expired/i)).toBeVisible();
  });
});
