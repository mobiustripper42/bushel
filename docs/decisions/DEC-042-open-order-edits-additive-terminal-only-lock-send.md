---
id: DEC-042
title: "Open-order edits: additive, terminal-only lock; send-state stays weekly"
topic: "Ordering, orders & statuses"
---

## DEC-042: Open-order edits: additive, terminal-only lock; send-state stays weekly

**Decision:** Adopt #218's append semantics unchanged. A customer may append items to a non-terminal order (`new`/`confirmed`/`ready`); appending a `confirmed`/`ready` order resets it to `new` and re-enters the send pipeline (existing Re-send covers the stale SMS); appending a terminal order is refused server-side. Editing is **add/increase only** — no removal or decrease ("remove an item" = text Annabel, DEC-015).

**Why:** Add-only keeps the `qty_available` decrement monotonic; allowing removal means re-incrementing, which races other carts and reopens the DEC-012 oversell window from the wrong side. The earlier "lock at `ready`" idea is dropped for #218's already-UAT'd through-`ready` behavior — a stray late append is a text-Annabel fix.

**Send-state stays week-keyed (decided against re-keying).** `customer_sends` keeps PK `(customer_id, week_of, mode)`. Considered re-keying to `(order_id, mode)` to handle a same-week re-order after fulfillment, but **rejected**: the weekly blast (`weekly_update`) is sent *before* any order exists, so order-keying it is wrong, and a habitual always-has-an-open-order customer would be mishandled. The weekly reset is the correct operator model — Annabel sends once a week. **Accepted limitation:** in the rare case a customer is fulfilled mid-week and re-orders before the Sunday reset, their second order inherits the first's send-state (no re-send nudge) — the same text-Annabel escape hatch.

---
