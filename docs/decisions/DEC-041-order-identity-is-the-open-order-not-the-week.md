---
id: DEC-041
title: "Order identity is the open order, not the week"
topic: "Ordering, orders & statuses"
---

## DEC-041: Order identity is the open order, not the week

**Decision:** Replace `orders`' `UNIQUE (customer_id, week_of)` with a **partial unique index**:

```sql
CREATE UNIQUE INDEX orders_one_open_per_customer
  ON public.orders (customer_id)
  WHERE status IN ('new', 'confirmed', 'ready');
```

A customer has at most one **non-terminal** order; fulfilled orders (`picked_up`/`delivered`) drop out, freeing a new one. `week_of` is **demoted to an informational stamp** — still set at insert, still feeds the fulfillment sheet + Wave export, no longer identity. `place_order`'s find-existing clause (from #218/DEC-039) re-keys week → open-status; the `submission_id` replay guard is untouched.

**Why:** "Always open + edit until fulfilled + new one after" is exactly "one row per (customer, non-terminal-status)." Postgres expresses it natively; no `week_of` arithmetic in the hot path. Demoting rather than dropping `week_of` keeps the weekly reports working.

**The RPC re-key is NOT a one-clause change.** `week_of` is load-bearing in four spots in #218's `place_order`: the `ON CONFLICT` arbiter (must infer the partial index — the concurrency linchpin), the `FOR UPDATE` existing-order lock, the outside-lock replay join, and the in-lock re-check (order-keyed, fine). Three are concurrency-critical; sized 5pt accordingly (architect pass, 2026-06-22).

**Cutover (hard cutover):** at go-live, wipe `orders` / `order_items` / `customer_sends`; keep `products` / `product_units` / `customers`. No history, no backfill. The old `UNIQUE (customer_id, week_of)` is dropped **in** the cutover, **not deferred** — it cannot coexist with the partial index through live traffic (it forbids the very second-same-week order the index allows). A brief quiet-minute outage is accepted.

---
