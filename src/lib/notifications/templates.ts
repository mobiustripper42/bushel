// Pre-filled SMS bodies for the three send-queue modes (DEC-026). Bodies are
// short by design — once the `sms:` link opens Messages, the operator can edit
// further before tapping Send. These functions lock the default shape; copy
// changes ship as PRs.

export type WeeklyUpdateInput = {
  customerName: string;
  tokenUrl: string;
  introNote: string | null;
};

export function weeklyUpdateBody({
  customerName,
  tokenUrl,
  introNote,
}: WeeklyUpdateInput): string {
  const header = `Hi ${customerName} — this week's Bay Branch Farm inventory is up.`;
  const trimmed = (introNote ?? "").trim();
  const link = `Order here: ${tokenUrl}`;
  return trimmed ? `${header}\n\n${trimmed}\n\n${link}` : `${header} ${link}`;
}

export type OrderConfirmationInput = {
  customerName: string;
  fulfillmentType: "pickup" | "delivery";
  pickupNote?: string | null;
  deliveryPreference?: string | null;
};

export function orderConfirmationBody(input: OrderConfirmationInput): string {
  const { customerName, fulfillmentType } = input;
  const head = `Hi ${customerName} — got your Bay Branch Farm order.`;

  if (fulfillmentType === "pickup") {
    const note = (input.pickupNote ?? "").trim();
    return note
      ? `${head} Pickup: ${note}. See you soon!`
      : `${head} See you at pickup!`;
  }

  const pref = (input.deliveryPreference ?? "").trim();
  return pref
    ? `${head} Delivery note: ${pref}. Thanks!`
    : `${head} We'll be in touch about delivery.`;
}

export type PickupReminderInput = {
  customerName: string;
};

export function pickupReminderBody({ customerName }: PickupReminderInput): string {
  return `Hi ${customerName} — reminder that your Bay Branch Farm order is ready for pickup this week. Text back if you need a different time.`;
}

export type DeliveryReminderInput = {
  customerName: string;
};

// #193 (amends DEC-014): delivery reminders are now sent, per-order from the
// Orders page. Distinct copy from the pickup reminder — it's coming to them.
export function deliveryReminderBody({
  customerName,
}: DeliveryReminderInput): string {
  return `Hi ${customerName} — reminder that your Bay Branch Farm order is out for delivery this week. Text back if anything needs to change.`;
}
