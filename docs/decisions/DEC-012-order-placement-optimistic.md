---
id: DEC-012
title: "Order placement: optimistic"
topic: "Ordering, orders & statuses"
---

## DEC-012: Order placement: optimistic

**Decision:** No strict rejection. Insert order + items in a transaction, decrement product qty (allow negative), set `needs_reconciliation` flag if any line went oversold. Admin sees flagged orders highlighted; reconciles via text.

**Why:** "Vegetables to friends, not heart medicine." May stay this way forever. Strict-rejection moved to Phase 7+ if needed.

---
