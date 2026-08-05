---
id: DEC-044
title: "Canonicalize `order_status` to snake_case (`picked_up`) — BUG"
topic: "Ordering, orders & statuses"
---

## DEC-044: Canonicalize `order_status` to snake_case (`picked_up`) — BUG

**Decision:** `picked_up` (underscore) is canonical everywhere. Migrate the TS layer — `ORDER_STATUSES`, transition guards, `narrowStatus`, `order-actions.tsx`, `order-row.tsx`, `report.ts` — from the hyphen form to underscore. No data backfill: `orders` is wiped at cutover.

**Why / symptom:** DB `codes` stores `picked_up`; the TS layer uses `picked-up`. `narrowStatus(s)` returns `"new"` for any DB value not in the hyphen-keyed `ORDER_STATUSES`, so a `picked_up` row reads back as **new** — fulfilled orders resurface as new in the admin list, and `report.ts`'s `o.status !== "picked-up"` exclusion misses them, so fulfilled orders keep printing on the harvest sheet. Underscore matches the DB convention (`needs_reconciliation`, `is_active`).

---
