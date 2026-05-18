# Open Items

Long-tail wishlist. **Not GitHub issues** — these are ideas with no committed work attached.

Promote to a GitHub `phase:N` issue when the trigger fires (real-world signal, design clarity, PO ack). The point of keeping them here instead of in GitHub is to avoid backlog inflation: every item in the issue list should be real work waiting to be picked; this file holds the "someday, maybe" pile that informs future planning.

## Conventions

- Each entry: **bolded name** + one-line description + optional DEC reference + trigger / dependency / why it's not an issue yet.
- New ideas go in **Triage** until they earn a section.
- Move to **Promoted** with a link when the item becomes a real issue.
- Move to **Dropped** with a reason when an item is affirmatively killed (so future-you doesn't re-add it).

## Triage

- **Self-serve customer order edits / cancellations** (DEC-015) — text-Annabel is the V1 workaround. Trigger: real customer asks more than once.
- **Delivery fee logic** (DEC-009) — separate from min-delivery [#138](https://github.com/mobiustripper42/bushel/issues/138). Trigger: PO input on fee structure (flat? distance-based? tiered?).
- **Strict-decrement / hard rejection on oversell** (DEC-012) — only if optimistic causes real operational pain. May stay forever.
- **Weekly inventory snapshots / history** — beyond pre-fill. Vague. Trigger: real use case ("what did I have on hand 6 weeks ago?").
- **Per-customer reminder preferences (incl. email channel)** (DEC-020) — `notification_preference` enum was replaced by `send_weekly_link` in migration 20260510. Email channel needs a real design.
- **Cron auto-close opt-in** (DEC-030) — infrastructure exists; Annabel hasn't asked. Trigger: Annabel mentions wanting orders to close automatically Wednesday night.

## Promoted

*(empty — entries move here with a `→ #NNN` link when filed as issues)*

## Dropped

*(empty — entries move here with a one-line reason when affirmatively killed)*
