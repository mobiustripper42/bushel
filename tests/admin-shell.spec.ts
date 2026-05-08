import { test, expect } from "@playwright/test";

// Authenticated-admin access cannot be automated (Google OAuth has no headless
// path). Verify the shell visually after signing in manually: sidebar nav,
// brand mark, and sign-out button should all be visible.

test.describe("admin shell", () => {
  test("unauthenticated /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders sign-in button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});
