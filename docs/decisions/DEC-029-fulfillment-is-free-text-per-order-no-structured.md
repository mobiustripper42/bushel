---
id: DEC-029
title: "Fulfillment is free-text per order; no structured pickup windows"
topic: "Fulfillment & invoicing"
amends:
  - id: DEC-013
    relation: supersedes
    scope: ""
---

## DEC-029: Fulfillment is free-text per order; no structured pickup windows

**Decision:** Drop the `pickup_windows` table and the structured-window picker. The customer order form has two free-text fields, one per fulfillment type:

- **Pickup:** `orders.pickup_note text NULL` — labeled "When are you picking up?", starts empty every week.
- **Delivery:** `orders.delivery_preference text NULL` — labeled "Delivery preference", **prefilled with the value from this customer's most recent prior `delivery` order** (so customers who switch pickup → delivery don't get stale pickup-time prefills).

Address pre-fill is unchanged (snapshot from `customers.delivery_address` per DEC-008). `orders.fulfillment_type` remains.

**Why:**
- At 7 customers, structured pickup-window scaffolding is overhead disproportionate to value. Annabel can read prose ("Wednesday afternoon, ~3 if that works") and plan her day.
- The pickup-window picker was a meaningful chunk of task 3.4 UI; removing it drops 3.4 from 8 pts to 5 pts.
- Delivery preferences are sticky-but-tweakable info ("leave at back door, gate code 4321"). Prefill-from-prior-order lets a customer keep using the same line week after week without forcing Annabel to maintain a customer-level field.

**Trade-offs accepted:**
- Operator loses the sortable "3 customers in the Wed 2–4 window" view that structured pickup windows enabled. Mental aggregation across prose is fine at 7 customers; would re-earn its keep around 25+.
- Free-text is unconstrained — a customer could type "midnight Tuesday" and it would land. Annabel reads and reacts; same as today's SMS workflow.

**Trigger to revisit:** customer count crosses ~25, or operator asks for grouped pickup-day planning. Migration back to structured windows is straightforward (text fields stay as a fallback "other").

**Supersedes:** DEC-013.

---
