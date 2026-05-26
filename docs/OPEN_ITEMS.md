# Open Items

Long-tail wishlist. **Not GitHub issues** — these are ideas with no committed work attached.

Promote to a GitHub `phase:N` issue when the trigger fires (real-world signal, design clarity, PO ack). The point of keeping them here instead of in GitHub is to avoid backlog inflation: every item in the issue list should be real work waiting to be picked; this file holds the "someday, maybe" pile that informs future planning.

## Conventions

- Each entry: **bolded name** + one-line description + optional DEC reference + trigger / dependency / why it's not an issue yet.
- New ideas go in **Triage** until they earn a section.
- Move to **Promoted** with a link when the item becomes a real issue.
- Move to **Dropped** with a reason when an item is affirmatively killed (so future-you doesn't re-add it).

## Triage

- **Delivery fee logic** (DEC-009) — separate from min-delivery (also parked, below). Trigger: PO input on fee structure (flat? distance-based? tiered?).
- **Strict-decrement / hard rejection on oversell** (DEC-012) — only if optimistic causes real operational pain. May stay forever.
- **Weekly inventory snapshots / history** — beyond pre-fill. Vague. Trigger: real use case ("what did I have on hand 6 weeks ago?").
- **Per-customer reminder preferences (incl. email channel)** (DEC-020) — `notification_preference` enum was replaced by `send_weekly_link` in migration 20260510. Email channel needs a real design.
- **Cron auto-close opt-in** (DEC-030) — infrastructure exists; Annabel hasn't asked. Trigger: Annabel mentions wanting orders to close automatically Wednesday night.
- **Whole-only vs. fractional units** (DEC-032 follow-on) — some units only make sense as whole counts (a "bag of lettuce", a "head of garlic") and others reasonably split (half-pound of basil). Add a `product_units.is_whole_only` boolean (default true matching current integer-qty behavior). When false, the customer stepper / qty input on that unit accepts decimals; `order_items.qty` would need to widen from `integer` to `numeric(10,2)` and the place_order decrement math is already numeric-safe. Trigger: real customer wants to order a half-pound of something. Dependency: 6.5c picker (#153) shipped, 6.5d fractional decrement (#154) shipped.

### Parked from issues (2026-05-26)

GitHub issues closed back into the parking lot — premature to commit work without a real-world trigger.

- **Self-serve customer order edits / cancellations** (DEC-015) — was #146 (~8 pts, needs split). V1 fallback is text-Annabel. Trigger: same customer asks more than once.
- **Per-customer pricing** (DEC-007 reversal candidate) — was #137. Wholesale/retail tiers or per-customer overrides via a `customer_product_prices(customer_id, product_id, price_cents)` table; admin UI per-customer override sheet; Wave export uses applied override. Interacts with multi-unit (DEC-032) — per-unit override is the natural extension. Tier-based ≈ 5 pts, full per-customer + UI + Wave ≈ 8 pts. Trigger: PO asks with a real customer in mind, OR multi-unit pricing conversation surfaces it naturally.
- **Customer order history** — was #136 (3 pts). New `/c/<token>/history` showing past N weeks (read-only, no re-order, no edit). Trigger: a restaurant asks for last-month's orders for their bookkeeping.
- **10DLC brand registration + A2P migration** (DEC-026) — was #139 (1 pt code + 4–8 week carrier approval clock). Reverses operator-sent SMS in part: migrate send path from `sms:` deep link → API send. Trigger: ~50 messages/week sustained, OR Annabel asks for unattended sends, OR carriers start filtering Bushel-derived links.
- **Minimum delivery amount** — was #138 (2 pts). Per-fulfillment-type dollar threshold; block submit below it for delivery (pickup probably exempt). Open Q: per-customer override (some restaurants free, some $40). Trigger: a $6 delivery to a restaurant actually happens and bites.
- **Realtime inventory subscription** (was Phase 3.8 ship-or-skip) — was #53 (5 pts). Supabase Realtime push of `products.qty_available` + `is_available` to the customer order form, behind `NEXT_PUBLIC_REALTIME_INVENTORY` flag. Tightens DEC-012's optimistic-placement window without replacing `needs_reconciliation`. Trigger: oversell becomes a frequent operational problem (e.g. Annabel reconciling multiple orders a week).
- **Make `product_units` strictly authoritative** — was #174. Drop the denormalized `products.unit` + `products.price_cents` columns and the bidirectional mirror triggers added in PR #175 (`task/7.x-inline-debug`). Replace remaining `products.unit` / `products.price_cents` readers (`src/lib/admin/orders-queries.ts:112` legacy fallback, `src/components/customer/OrderForm.tsx` defensive fallbacks) with `product_units` joins; saveInventory stops writing the mirror columns; migration drops them. Trigger: a third drift symptom from the dual-storage mirror, OR the inline-debug stack settles enough that this cleanup is worth the migration cost.
- **Inventory drag-reorder above/below precision** — was #168. Split each row into upper/lower halves by cursor Y (`getBoundingClientRect().top + height/2`); below-half drops splice *after* the target. ~20 LOC + an `insertPosition: 'before' | 'after'` param on `reorderRows`. Bundled: "Save N changes" copy could special-case reorder-only diffs (one-row drag currently reports "Save 3 changes" because every row's sort_order shifts). Trigger: Annabel notices the down-drag asymmetry, OR a second person hits the surprising copy.

## Promoted

*(empty — entries move here with a `→ #NNN` link when filed as issues)*

## Dropped

*(empty — entries move here with a one-line reason when affirmatively killed)*
