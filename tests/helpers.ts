import { Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

export function customerOrderUrl(token: string): string {
  return `${BASE_URL}/c/${token}`;
}

export async function loginAsAdmin(page: Page): Promise<void> {
  // Admin auth goes through Google OAuth — not automatable in Playwright.
  // This helper is a placeholder for future cookie/session injection once
  // we have a test-mode bypass (tracked in Phase 0.6 CI work).
  throw new Error("Admin auth not yet automatable — see Phase 0.6");
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
