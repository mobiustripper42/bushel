---
id: DEC-045
title: "Admin orders list keyed to the open-order model (follows DEC-041)"
topic: "Admin surface & UI"
---

## DEC-045: Admin orders list keyed to the open-order model (follows DEC-041)

**Decision:** `/admin/orders` drops its current-week filter (`listOrders`' `.eq("week_of", weekOf)`) and defaults to **active (non-terminal)** orders, with a way to browse fulfilled/past orders. The stale `customer_sends` sends-join comment + logic ("one order per customer per week → `customer_id` maps 1:1 to an order") is corrected — the join stays week-keyed per DEC-042; only the broken 1:1 assumption is fixed.

**Why:** Under DEC-041 orders are no longer week-aligned, so a week-filtered list silently drops orders that stay open across a week boundary. Fulfilled orders persist as rows (the open-order model only removes them from the partial index + the editable view), so "view past orders" is a read/UI feature — and this is its natural home.

**Scope:** admin-only. Customer-facing history (#136, `/c/[token]/history`) stays in the backlog.

---

---
