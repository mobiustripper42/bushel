---
id: DEC-039
title: "Additive orders: append to the week's single order (#211)"
topic: "Ordering, orders & statuses"
---

## DEC-039: Additive orders: append to the week's single order (#211)

**Decision:** A customer can submit additional items while ordering is open. Additions append `order_items` to the existing `(customer, week)` order — the `unique (customer_id, week_of)` constraint stays. Appends inherit the order's fulfillment unchanged (the add-mode form shows it read-only; change = text Annabel, DEC-015). An append resets a `confirmed`/`ready` order to `new` (re-enters Annabel's pipeline; the existing Re-send affordance covers the now-stale confirmation SMS) and is refused when terminal (`picked-up`/`delivered` — the box is gone).

**Idempotency:** `place_order`'s on-conflict no-op is replaced by a client-generated `order_items.submission_id` — replaying an already-applied submission returns the existing order with no second decrement. It doubles as a per-submission audit trail (which submit attempt created each line). The RPC now returns `table(order_id, appended)` so the action can pick "new order" vs "added N items" alert copy.

**Rejected:** multiple order rows per customer-week — breaks `customer_sends` keying (`(customer_id, week_of, mode)` PK), `getCurrentWeekOrder`'s `maybeSingle()`, the 1:1 admin sends join, and doubles Annabel's per-customer fulfillment steps.
---
