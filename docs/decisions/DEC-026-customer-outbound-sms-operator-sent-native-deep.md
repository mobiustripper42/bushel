---
id: DEC-026
title: "Customer outbound SMS: operator-sent native deep links"
topic: "Notifications & alerting"
amends:
  - id: DEC-020
    relation: supersedes
    scope: "the customer-outbound leg — operator-sent sms: deep links replace automated SMS"
---

## DEC-026: Customer outbound SMS: operator-sent native deep links

**Decision:** Bushel does not send customer SMS itself. The admin UI generates `sms:+1XXXXXXXXXX?body=<encoded>` URIs and surfaces them as per-customer "Send" buttons. Operator taps a button → her native Messages app opens with the recipient and message body pre-filled → she taps Send. The send-queue UI tracks which customers have been marked sent for the current cycle (weekly update, order confirmation, pickup reminder).

**Why:**
- ~21 messages/week across 7 customers — Twilio's 10DLC compliance overhead (brand registration, campaign vetting, ~10–15 business-day approval, ongoing fees) is disproportionate.
- Operator-sent from a personal handset is P2P, sitting outside the A2P regulatory perimeter (TCR, TCPA, carrier review).
- Operator already does this manually today. The deep-link approach speeds up an existing behavior; it doesn't change who sends or how.
- Customer replies route to the operator's cell directly, matching current behavior.

**Trade-offs accepted:**
- Manual send required per message. ~21 taps/week is fine; not viable at 50+ customers.
- No carrier delivery receipts. Sent-status is "operator marked sent," not "carrier confirmed delivered."
- Operator's personal number is the sender. If the operator ever wants Bushel-branded sender ID, that triggers A2P registration.

**Send queue ordering:** Customers carry a `priority` column; the send queue lists customers in priority order so high-priority customers receive each cycle's message first. No enforced delay between sends — manual pacing diffuses the inventory-page load naturally.

**Trigger to revisit:** ~50 messages/week, or operator wants automated unattended sends. At that point, register a Bushel 10DLC brand under the farm's EIN and migrate to A2P. Deferred to Phase 7+.

**Supersedes:** DEC-020 (customer-outbound SMS path).

---
