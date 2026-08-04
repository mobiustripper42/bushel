---
id: DEC-036
title: "Optimistic oversell (DEC-012) does not extend to qty=0 (#132)"
topic: "Ordering, orders & statuses"
---

## DEC-036: Optimistic oversell (DEC-012) does not extend to qty=0 (#132)

**Decision:** `place_order` rejects any line item whose product has `qty_available = 0` at submit time. DEC-012's optimistic placement — let the "last few" oversell and flag `needs_reconciliation` — applies **only while `qty_available > 0`**. Zero means truly unavailable (DEC-031), so an order against it is refused, not driven negative.

**Why:**
- UAT (#132) surfaced an order for qty=4 against `qty_available = 0`. The customer form already greys sold-out rows and pins the stepper to 0 (DEC-031), so this was only reachable via the stale-tab race: page loaded with stock → inventory hit 0 (admin edit or another order) → customer submitted the stale cart. DEC-012's unconditional decrement then drove the product to −4 and flagged reconciliation — a "successful" oversell of something with nothing left.
- DEC-031 says qty=0 is uneditable "period." Honoring that only in the client (load-time) but not the server (submit-time) left the race open. DEC-036 closes it server-side.

**Implementation:**
- The decrement becomes `UPDATE products SET qty_available = qty_available - n WHERE id = ? AND qty_available > 0` plus `IF NOT FOUND THEN RAISE … sold out` (migration `20260611213000_place_order_reject_soldout.sql`). The `qty_available > 0` guard is part of the write, so the check is race-free; a raise mid-loop rolls back the whole order (atomic — no partial order, no orphaned decrement).
- `place-order.ts` maps the raise to a friendly "Some items sold out — reload" message; reloading re-fetches inventory and greys the rows.
- Unchanged: `qty_available > 0` but insufficient still oversells into the negative and flags `needs_reconciliation` — the intended DEC-012 "last few" behavior.

---
