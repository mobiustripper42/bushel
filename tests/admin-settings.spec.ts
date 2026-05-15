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
    // Wait for client component to hydrate (toggle button is rendered by SettingsScheduleCard)
    await expect(
      page.getByRole("button", { name: /weekly schedule/ })
    ).toBeVisible({ timeout: 10000 });

    const saveBtn = page.getByRole("button", { name: "Save settings" });
    await expect(saveBtn).toBeDisabled();

    const enableBtn = page.getByRole("button", { name: "Enable weekly schedule" });
    const disableBtn = page.getByRole("button", { name: "Disable weekly schedule" });
    if (await enableBtn.isVisible()) {
      await enableBtn.click();
    } else {
      await disableBtn.click();
    }
    await expect(saveBtn).toBeEnabled({ timeout: 3000 });
  });

  test("discard resets dirty state", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("button", { name: /weekly schedule/ })
    ).toBeVisible({ timeout: 10000 });

    const enableBtn = page.getByRole("button", { name: "Enable weekly schedule" });
    const disableBtn = page.getByRole("button", { name: "Disable weekly schedule" });
    if (await enableBtn.isVisible()) {
      await enableBtn.click();
    } else {
      await disableBtn.click();
    }

    const saveBtn = page.getByRole("button", { name: "Save settings" });
    await expect(saveBtn).toBeEnabled({ timeout: 3000 });

    await page.getByRole("button", { name: "Discard" }).click();
    await expect(saveBtn).toBeDisabled({ timeout: 3000 });
  });

  test("open/close now buttons update ordering state", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page.locator(".set-state-block")).toBeVisible({ timeout: 10000 });

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
    await expect(
      page.getByRole("button", { name: /weekly schedule/ })
    ).toBeVisible({ timeout: 10000 });

    const disableBtn = page.getByRole("button", { name: "Disable weekly schedule" });
    if (await disableBtn.isVisible()) {
      await disableBtn.click();
    }

    await expect(page.locator(".set-control.is-day").first()).toBeDisabled({ timeout: 3000 });
    await expect(page.locator(".set-control.is-time").first()).toBeDisabled({ timeout: 3000 });
  });
});
