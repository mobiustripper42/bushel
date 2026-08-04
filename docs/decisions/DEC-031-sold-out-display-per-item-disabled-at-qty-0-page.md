---
id: DEC-031
title: "Sold-out display: per-item disabled at qty=0; page-level empty state when all visible items are sold out"
topic: "Catalog, pricing & units"
---

## DEC-031: Sold-out display: per-item disabled at qty=0; page-level empty state when all visible items are sold out

**Decision:** The customer inventory page renders four distinct states, depending on the combination of `ordering_schedule.is_open` and `products.qty_available`:

| Store toggle | Inventory | Customer sees |
|---|---|---|
| Closed (manual) | any | "Orders are closed this week" message; no form |
| Open | all visible items qty > 0 | Normal order form |
| Open | some items qty = 0 (or qty < smallest active unit's `conversion_to_base` once DEC-032 lands) | Form renders; those rows greyed out with "Sold out" in place of the qty stepper |
| Open | no visible item is orderable | "Everything sold out — check back next week" empty state; no form |

**Why:**
- Disabled-not-hidden gives customers visibility into what *was* on offer this week, which informs their ordering rhythm ("kale moves fast — I'll order Monday next time").
- If Annabel restocks mid-week, the same row re-enables — no row-add/row-remove churn.
- `is_available = false` rows stay filtered out entirely. "Not on the menu this week" is a separate concept from "ran out." Both the per-item disable and the all-sold-out empty state ignore `is_available = false` rows.

**Interaction with DEC-012 (optimistic placement):** The disable is a soft UI hint, not enforcement. A customer who loaded the page when qty=1 and submits after someone else bought the last one still has their order accepted; `needs_reconciliation` fires and Annabel texts to resolve. This is intentional and unchanged. Realtime inventory subscription (Phase 3.8, dark-flagged) would tighten this further if shipped.

---
