import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./helpers";

test.describe("admin settings", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("renders settings page with schedule card", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page.locator(".set-title")).toBeVisible();
    await expect(page.getByText("Ordering schedule")).toBeVisible();
    await expect(page.getByText("01 · Cadence")).toBeVisible();
  });

  test("save bar hidden when clean, visible after schedule change", async ({ page }) => {
    await page.goto("/admin/settings");
    const saveBtn = page.getByRole("button", { name: "Save settings" });
    // bar is hidden initially (opacity 0 / pointer-events none)
    await expect(saveBtn).toBeDisabled();

    // Toggle the schedule switch to dirty the form
    const toggle = page.getByRole("button", { name: /schedule/i }).first();
    await toggle.click();
    await expect(saveBtn).toBeEnabled();
  });

  test("discard resets dirty state", async ({ page }) => {
    await page.goto("/admin/settings");
    const toggle = page.getByRole("button", { name: /schedule/i }).first();
    await toggle.click();

    const saveBtn = page.getByRole("button", { name: "Save settings" });
    await expect(saveBtn).toBeEnabled();

    await page.getByRole("button", { name: "Discard" }).click();
    await expect(saveBtn).toBeDisabled();
  });

  test("open/close now buttons update ordering state", async ({ page }) => {
    await page.goto("/admin/settings");

    const stateBlock = page.locator(".set-state-block");
    await expect(stateBlock).toBeVisible();

    // Determine current state and click the opposite
    const openBtn = page.getByRole("button", { name: "Open now" });
    const closeBtn = page.getByRole("button", { name: "Close now" });

    if (await openBtn.isVisible()) {
      await openBtn.click();
      await expect(closeBtn).toBeVisible({ timeout: 5000 });
    } else {
      await closeBtn.click();
      await expect(openBtn).toBeVisible({ timeout: 5000 });
    }
  });

  test("schedule fields disabled when use-schedule toggle is off", async ({ page }) => {
    await page.goto("/admin/settings");

    // Turn schedule off if it's on
    const toggle = page.getByRole("button", { name: /Disable weekly schedule/i });
    if (await toggle.isVisible()) {
      await toggle.click();
    }

    await expect(page.locator(".set-control.is-day").first()).toBeDisabled();
    await expect(page.locator(".set-control.is-time").first()).toBeDisabled();
  });
});
