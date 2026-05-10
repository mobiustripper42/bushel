import { Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

export const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";

export function customerOrderUrl(token: string): string {
  return `${BASE_URL}/c/${token}`;
}

// Admin session is injected via global-setup.ts (cookie-based, no OAuth needed).
// Use `test.use({ storageState: ADMIN_STORAGE_STATE })` in authenticated test blocks.
export async function loginAsAdmin(_page: Page): Promise<void> {
  // No-op: session is pre-loaded via storageState. Call this only if you need
  // to navigate after storage state is already applied.
}

export const TEST_CUSTOMERS = {
  farmStand: {
    name: "Test Farm Stand",
    token: "testtoken-farmstand-0001",
  },
  restaurant: {
    name: "Test Restaurant",
    token: "testtoken-restaurant-0001",
  },
} as const;
