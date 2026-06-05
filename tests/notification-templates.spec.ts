import { expect, test } from "@playwright/test";

import {
  deliveryReminderBody,
  orderConfirmationBody,
  pickupReminderBody,
  weeklyUpdateBody,
} from "@/lib/notifications/templates";

// Pure-function unit tests, same harness as sms-deep-link.spec.ts.
// Templates are the body strings the operator's Messages app pre-fills.
// They're deliberately short — operator can edit in Messages before tapping
// Send. We're locking the *shape*, not optimizing copy.

test.describe("weeklyUpdateBody", () => {
  test("renders header + token URL when intro is empty", () => {
    expect(
      weeklyUpdateBody({
        customerName: "Hannah",
        tokenUrl: "https://order.baybranchfarm.com/c/abcd1234",
        introNote: "",
      }),
    ).toBe(
      "Hi Hannah — this week's Bay Branch Farm inventory is up. Order here: https://order.baybranchfarm.com/c/abcd1234",
    );
  });

  test("injects intro between header and token URL", () => {
    expect(
      weeklyUpdateBody({
        customerName: "Hannah",
        tokenUrl: "https://order.baybranchfarm.com/c/abcd1234",
        introNote: "Sungolds are exceptional this week.",
      }),
    ).toBe(
      "Hi Hannah — this week's Bay Branch Farm inventory is up.\n\nSungolds are exceptional this week.\n\nOrder here: https://order.baybranchfarm.com/c/abcd1234",
    );
  });

  test("trims intro whitespace before injecting", () => {
    expect(
      weeklyUpdateBody({
        customerName: "Hannah",
        tokenUrl: "https://example/c/x",
        introNote: "  Note with padding.  \n",
      }),
    ).toContain("\n\nNote with padding.\n\n");
  });

  test("treats whitespace-only intro as empty", () => {
    expect(
      weeklyUpdateBody({
        customerName: "Hannah",
        tokenUrl: "https://example/c/x",
        introNote: "   \n  ",
      }),
    ).toBe(
      "Hi Hannah — this week's Bay Branch Farm inventory is up. Order here: https://example/c/x",
    );
  });
});

test.describe("orderConfirmationBody", () => {
  test("pickup order confirmation", () => {
    expect(
      orderConfirmationBody({
        customerName: "Tom",
        fulfillmentType: "pickup",
        pickupNote: "Coming Thursday afternoon",
      }),
    ).toBe(
      "Hi Tom — got your Bay Branch Farm order. Pickup: Coming Thursday afternoon. See you soon!",
    );
  });

  test("pickup order with no note", () => {
    expect(
      orderConfirmationBody({
        customerName: "Tom",
        fulfillmentType: "pickup",
        pickupNote: null,
      }),
    ).toBe("Hi Tom — got your Bay Branch Farm order. See you at pickup!");
  });

  test("delivery order confirmation", () => {
    expect(
      orderConfirmationBody({
        customerName: "Maria",
        fulfillmentType: "delivery",
        deliveryPreference: "Back door, gate code 4321",
      }),
    ).toBe(
      "Hi Maria — got your Bay Branch Farm order. Delivery note: Back door, gate code 4321. Thanks!",
    );
  });

  test("delivery order with no preference", () => {
    expect(
      orderConfirmationBody({
        customerName: "Maria",
        fulfillmentType: "delivery",
        deliveryPreference: null,
      }),
    ).toBe("Hi Maria — got your Bay Branch Farm order. We'll be in touch about delivery.");
  });
});

test.describe("pickupReminderBody", () => {
  test("includes customer name and pickup-day reminder", () => {
    expect(pickupReminderBody({ customerName: "Hannah" })).toBe(
      "Hi Hannah — reminder that your Bay Branch Farm order is ready for pickup this week. Text back if you need a different time.",
    );
  });
});

test.describe("deliveryReminderBody (#193)", () => {
  test("includes customer name and delivery wording (distinct from pickup)", () => {
    expect(deliveryReminderBody({ customerName: "Hannah" })).toBe(
      "Hi Hannah — reminder that your Bay Branch Farm order is out for delivery this week. Text back if anything needs to change.",
    );
  });
});
