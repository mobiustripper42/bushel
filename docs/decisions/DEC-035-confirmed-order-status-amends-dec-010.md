---
id: DEC-035
title: "\"Confirmed\" order status (amends DEC-010)"
topic: "Ordering, orders & statuses"
amends:
  - id: DEC-010
    relation: amends
    scope: "adds the Confirmed status; the rest of the status set stands"
---

## DEC-035: "Confirmed" order status (amends DEC-010)

**Decision:** "Confirmed" is a real order status between New and Ready. The flow is **new → [confirmed] → ready → (picked-up | delivered)**, where `confirmed` is **optional**:
- `new → confirmed` — set when Annabel sends the order-confirmation text (auto-advance), or manually.
- `new → ready` — kept. Annabel may pack an order before texting, so confirmed can be skipped.
- `confirmed → ready`, then `ready → picked-up | delivered` (fulfillment-pinned terminal).

**No-regress guard:** sending the confirmation text auto-advances a `new` order to `confirmed`, but must **never** regress a `ready`/terminal order. The rule is the pure helper `statusAfterConfirmSend(s) = s === "new" ? "confirmed" : s` (`src/lib/admin/orders-queries.ts`), wired to the confirm-send button in the Orders-page action stack (#192).

**Why:**
- The order-status redesign (design PR #187) needs a confirmation state distinct from "packed and ready." Confirmed = "we've acknowledged the order to the customer"; ready = "it's physically packed."
- Optional, not mandatory, because the farm's real workflow sometimes packs first. Forcing confirm-before-ready would fight how Annabel works.

**Implementation:**
- `codes` gains `('order_status','confirmed','Confirmed',2)`; `ready`/`picked_up`/`delivered` renumber to 3/4/5 (migration `20260604200000_order_status_confirmed.sql`).
- `orders.status` stays app-enforced text (no FK/constraint) per DEC-010. The transition table lives in TS (`isValidTransition`, `orders-queries.ts`), not the DB.

**Foundation for:** the Orders redesign — #191 (shared SendAction), #192 (per-order action stack), #193 (delivery reminder) build on this status.

---
