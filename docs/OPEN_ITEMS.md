# Open Items

Long-tail wishlist. **Not GitHub issues** — these are ideas with no committed work attached.

Promote to a GitHub `phase:N` issue when the trigger fires (real-world signal, design clarity, PO ack). The point of keeping them here instead of in GitHub is to avoid backlog inflation: every item in the issue list should be real work waiting to be picked; this file holds the "someday, maybe" pile that informs future planning.

## Conventions

- Each entry: **bolded name** + one-line description + optional DEC reference + trigger / dependency / why it's not an issue yet.
- New ideas go in **Triage** until they earn a section.
- Move to **Promoted** with a link when the item becomes a real issue.
- Move to **Dropped** with a reason when an item is affirmatively killed (so future-you doesn't re-add it).

## Triage

- **Delivery fee logic** (DEC-009) — separate from min-delivery [#138](https://github.com/mobiustripper42/bushel/issues/138). Trigger: PO input on fee structure (flat? distance-based? tiered?).
- **Strict-decrement / hard rejection on oversell** (DEC-012) — only if optimistic causes real operational pain. May stay forever.
- **Weekly inventory snapshots / history** — beyond pre-fill. Vague. Trigger: real use case ("what did I have on hand 6 weeks ago?").
- **Per-customer reminder preferences (incl. email channel)** (DEC-020) — `notification_preference` enum was replaced by `send_weekly_link` in migration 20260510. Email channel needs a real design.
- **Cron auto-close opt-in** (DEC-030) — infrastructure exists; Annabel hasn't asked. Trigger: Annabel mentions wanting orders to close automatically Wednesday night.
- **Whole-only vs. fractional units** (DEC-032 follow-on) — some units only make sense as whole counts (a "bag of lettuce", a "head of garlic") and others reasonably split (half-pound of basil). Add a `product_units.is_whole_only` boolean (default true matching current integer-qty behavior). When false, the customer stepper / qty input on that unit accepts decimals; `order_items.qty` would need to widen from `integer` to `numeric(10,2)` and the place_order decrement math is already numeric-safe. Trigger: real customer wants to order a half-pound of something. Dependency: 6.5c picker (#153) shipped, 6.5d fractional decrement (#154) shipped.

## Promoted

*(empty — entries move here with a `→ #NNN` link when filed as issues)*

[#146](https://github.com/mobiustripper42/bushel/issues/146)
**Self-serve customer order edits / cancellations** (DEC-015) — text-Annabel is the V1 workaround. Trigger: real customer asks more than once. 

## Dropped

*(empty — entries move here with a one-line reason when affirmatively killed)*
