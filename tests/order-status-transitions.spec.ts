import { test, expect } from "@playwright/test";

import {
  ORDER_STATUSES,
  isValidTransition,
  statusAfterConfirmSend,
} from "@/lib/admin/orders-queries";

// #190 / DEC-035 — pure transition-table coverage. The valid-transition logic
// lives in TS (orders.status is app-enforced text, no DB constraint), so it's
// unit-tested here rather than in pgTAP.

test.describe("order status flow (DEC-035)", () => {
  test("ORDER_STATUSES matches the codes ordinal order", () => {
    expect(ORDER_STATUSES).toEqual([
      "new",
      "confirmed",
      "ready",
      "picked-up",
      "delivered",
    ]);
  });

  test("every valid path is allowed", () => {
    expect(isValidTransition("new", "confirmed", "pickup")).toBe(true);
    expect(isValidTransition("new", "confirmed", "delivery")).toBe(true);
    // confirmed is optional — new → ready stays valid
    expect(isValidTransition("new", "ready", "pickup")).toBe(true);
    expect(isValidTransition("confirmed", "ready", "delivery")).toBe(true);
    expect(isValidTransition("ready", "picked-up", "pickup")).toBe(true);
    expect(isValidTransition("ready", "delivered", "delivery")).toBe(true);
  });

  test("terminal state is pinned to fulfillment type", () => {
    expect(isValidTransition("ready", "picked-up", "delivery")).toBe(false);
    expect(isValidTransition("ready", "delivered", "pickup")).toBe(false);
  });

  test("skips, regressions, and nonsense transitions are rejected", () => {
    expect(isValidTransition("new", "picked-up", "pickup")).toBe(false);
    expect(isValidTransition("new", "delivered", "delivery")).toBe(false);
    expect(isValidTransition("confirmed", "new", "pickup")).toBe(false);
    expect(isValidTransition("ready", "confirmed", "pickup")).toBe(false);
    expect(isValidTransition("picked-up", "ready", "pickup")).toBe(false);
    expect(isValidTransition("delivered", "ready", "delivery")).toBe(false);
  });

  test("confirm-send auto-advance never regresses (no-regress guard)", () => {
    expect(statusAfterConfirmSend("new")).toBe("confirmed");
    expect(statusAfterConfirmSend("confirmed")).toBe("confirmed");
    expect(statusAfterConfirmSend("ready")).toBe("ready");
    expect(statusAfterConfirmSend("picked-up")).toBe("picked-up");
    expect(statusAfterConfirmSend("delivered")).toBe("delivered");
  });
});
