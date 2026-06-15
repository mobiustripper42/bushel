# Demand-aware restock — break the stockout ratchet in "Pre-fill from last week"

*Tiller proposal · 2026-06-15 · bushel*

## The idea

"Pre-fill from last week" looks like it closes the loop between demand and
supply, and it almost does — but it has a sign error baked in. The current
`prepopulate_inventory_from_last_week()` RPC **overwrites** each product's
`qty_available` to *exactly* last week's sold quantity (`floor(sum(qty *
conversion_to_base))` over `max(week_of) < today`). The problem: **last week's
sold is capped by last week's supply.** If basil was stocked at 20 and sold out
Tuesday, "sold = 20" understates true demand — and the button restocks it at 20
again, guaranteeing it sells out again. The action quietly re-creates last
week's stockouts on exactly your best sellers, every week, and nobody sees the
counterfactual ("how much basil *would* have sold if it hadn't run out"). On
top of that it reads a single, noisy week — one big restaurant order or one slow
holiday week sets next week's whole stock — and it writes the number invisibly:
Annabel clicks, twelve quantities change, she sees "Restored qty on N products"
and no *why*.

The fix is a **demand panel in the inventory editor** that turns the weekly
reset from a blind one-shot overwrite into a visible, outcome-driven decision,
entirely from data already owned and already loaded:

1. **Trailing demand, not last-week-only.** The inventory page already loads
   *this* week's sold-per-product in base units
   (`order_items → product_units(conversion_to_base)`, filtered to the current
   `week_of`) and renders it as the "Sold" column. Widen that one filter to the
   last *N completed* weeks and show a small per-product sparkline / figures:
   each week's demand + a trailing summary (max and median are the useful two).
   This-week's number is nearly useless for stocking *this* week — the week is
   still in progress; the last few *finished* weeks are the signal.
2. **Flag censored weeks.** `orders.needs_reconciliation` is set true by
   `place_order` on any oversold line and is **never cleared anywhere in the
   codebase** — so "this product's demand exceeded supply in week W" is a
   persisted, queryable fact. Mark any product that appeared on a
   `needs_reconciliation` order in the window with a "⚠ oversold — true demand
   was higher than the number shown." That marker is the whole point: it tells
   Annabel which suggested figures are a **floor to bump**, not a ceiling to
   copy. It's a *proven* oversell, not an inference — better than guessing.
3. **Reseed from the trailing stat.** Change the Pre-fill action to seed
   `qty_available` from a trailing statistic (default: `max` over the last N
   weeks, which already leans against the censoring bias; optionally
   trailing-median + a headroom %), keeping it overwrite/idempotent so clicking
   twice is still safe. Oversold weeks could be lifted by an extra headroom
   bump, but even plain `max-of-N` beats `last-week-only` immediately.

Read-only over `order_items` + `orders.needs_reconciliation`. **No new table, no
new write path, no RLS change, no migration** beyond optionally swapping the
body of one existing RPC. The editor column, the base-unit join, and the
fire-and-forget action are all already there — this widens a `WHERE`, adds a
join to `orders.needs_reconciliation`, and renders what comes back.

## Why it's worth it

The weekly stock-set is the single highest-leverage number Annabel types, and
it's currently driven by the one heuristic with a built-in ratchet *against* her
bestsellers. The leverage is asymmetric: the items the censoring bias hurts are
precisely the ones she most wants to sell more of, and the loss is invisible —
a sale that never happened because the item greyed out leaves no row anywhere.
Surfacing trailing demand + the oversold flag converts that invisible loss into
a number on the screen at the exact moment she's deciding. And the cost is
shallow because the hard parts already shipped: the base-unit conversion is
honest (multi-unit landed in Phase 7; the Pre-fill RPC is already unit-aware as
of `prepopulate_unit_aware`), the editor already renders a base-unit sold
column, and the page already runs the `order_items → product_units` join. **Why
now:** until base-unit conversion shipped, summing demand across a product's
mixed units (3 pints + 2 flats) into one trustworthy figure was garbage-in —
the same enabling fact the Harvest & Pack sheet used, applied across *weeks*
(stocking intelligence) instead of within one week (fulfillment).

## Why you haven't already

Because the button *looks* finished. It already reads real orders, already folds
through `conversion_to_base`, already produces a plausible-looking number — so
"restock from demand" reads as solved and checked off. The censoring bias is
invisible precisely because the output looks reasonable: nothing on the screen
says "this 20 is a stockout ceiling, not a demand figure," and the demand that
supply truncated leaves no trace to contradict it. It's an absence by
plausibility, not by decision — and it's adjacent to, but sharper than, the
`OPEN_ITEMS` "weekly inventory snapshots / history" entry, which is parked as
*vague, no trigger*. This isn't a history browser; it's a decision-point overlay
on an action that already exists, with a concrete trigger (the weekly reset
ritual) and a concrete artifact (the number she types), and it needs no snapshot
table because the demand history is already retained in `order_items`.

## Build handoff

### Approach

Two clean tiers. **Tier 1 ships now, read-only, no migration** beyond optionally
re-bodying one RPC. **Tier 2 is a flagged fork** Eric decides on, because it
reintroduces a write path.

- **Tier 1a — trailing-demand panel (read-only).** Generalize the inventory
  page's existing `weekItemsRes` query from "this week" to "last N completed
  weeks," aggregate per product per week in base units, and pass a
  `demandByProductId: Record<string, WeekDemand[]>` into the editor. Render it
  beside the existing "Sold" column. Join `orders.needs_reconciliation` so each
  product carries an `oversoldInWindow: boolean`.
- **Tier 1b — reseed Pre-fill from the trailing stat.** Swap the body of
  `prepopulate_inventory_from_last_week()` to seed from `max` (or
  trailing-median + headroom) over the last N weeks instead of `max(week_of)`
  only. Keep return shape and idempotency. This is the one optional schema-ish
  change and it's a pure function-body swap — no column/table change.
- **Tier 2 — true sold-out timing (fork, needs a write path).** "Sold out
  Tuesday at 2pm" is *not* recoverable from owned data: `qty_available` is
  mutated continuously and overwritten weekly, so a product that hit exactly 0
  without going negative leaves no trace (the oversold/`needs_reconciliation`
  flag only catches lines that drove it *past* 0). Recovering real timing needs
  a weekly **starting-inventory snapshot** (one row per product per week, written
  when Annabel finalizes the week / first sends). That's a new table + write
  path and it overlaps the parked "weekly snapshots" `OPEN_ITEMS` entry —
  **don't build it inside Tier 1.** Note it, let Eric pull the trigger
  separately. Tier 1's `oversoldInWindow` flag is the honest, zero-cost
  substitute: it answers "was demand censored here?" (the actionable question)
  without answering "exactly when?" (the nice-to-have).

Pick `N` (default 4 completed weeks). Make it a single named constant, not a
magic number.

### File-by-file

- **`src/app/(admin)/admin/inventory/page.tsx`** — the `weekItemsRes` query
  (currently `order_items.select(product_id, qty, product_units(conversion_to_base),
  orders!inner(week_of)).eq("orders.week_of", weekOf)`) becomes a trailing-window
  read: compute the N prior Monday `week_of` values (reuse `weekOfMondayNY()` and
  a week-stepping helper in `src/lib/week.ts`), `.in("orders.week_of", weeks)` or
  `.gte`, and also select `orders!inner(week_of, needs_reconciliation)`.
  Aggregate per `(product_id, week_of)` into base units client-side (same
  `qty * conversion_to_base` fold already used for `soldByProductId`); derive
  `oversoldInWindow` per product from any row whose order has
  `needs_reconciliation = true`. Keep the existing loud-fail-on-error
  short-circuit. Pass `demandByProductId` + `oversoldByProductId` into
  `<InventoryEditor>`.
- **`src/lib/week.ts`** — add a small pure helper, e.g.
  `priorWeekMondays(n: number, from = weekOfMondayNY()): string[]`. Unit-test it
  (DST-safe — bushel pins NY time; the existing `weekOfMondayNY` is the
  reference).
- **`src/components/admin/inventory-editor.tsx`** — extend `Props` with
  `demandByProductId` + `oversoldByProductId`; thread into rows. The "Sold"
  `<th>` becomes (or gains a sibling) "Demand (4 wk)".
- **`src/components/admin/inventory-row.tsx`** — render the trailing figures
  (a compact `max · median`, or a 4-cell sparkline) and the ⚠ oversold marker
  when `oversoldInWindow`. Reuse `fmtSold()` for base-unit formatting. Keep the
  cell narrow; this is a dense admin table.
- **`supabase/migrations/<ts>_prepopulate_trailing_demand.sql`** *(Tier 1b,
  optional)* — `create or replace function prepopulate_inventory_from_last_week()`
  seeding from the trailing stat. Mirror the current body's structure
  (`20260526182702_prepopulate_overwrite_qty_only.sql`): same `floor(...
  conversion_to_base)`, same overwrite-and-idempotent shape, same return
  signature — only the window + the aggregate (`max`/`median` instead of last
  week's `sum`) change. **Test against local first** (`supabase db reset`), then
  dev/preview, per the two-project migration discipline in
  `.claude/CLAUDE-context.md`.
- **Tests** — `tests/` Playwright spec: seed 3–4 weeks of orders (one product
  oversold in week W via an oversell), load `/admin/inventory`, assert the
  trailing figures + the ⚠ marker on the oversold product, and (Tier 1b) that
  Pre-fill seeds `max-of-N` not last-week. `supabase/tests/` pgTAP only if the
  RPC body changes (Tier 1b) — assert idempotency + the trailing-stat math.
  Heavy-integration / light-unit per DEC-023.

### Gotchas / risks

- **Never sum raw `qty` across a product's units.** Always fold through
  `conversion_to_base` (3 pints + 2 flats ≠ 5). The page already does this for
  the current week — match it exactly for the trailing window.
- **"Completed" weeks only.** Exclude the in-progress current `week_of` from the
  trailing stat, or a half-finished week drags the suggestion down.
- **`needs_reconciliation` is order-level, not line-level.** An order flagged
  for an oversold tomato also "touches" the basil on the same order. For the
  flag's purpose (was *this product* plausibly demand-censored?) that's an
  acceptable over-broad signal at 7–11 customers — but say so in a comment; if
  it ever feels noisy, tighten to lines whose product actually went negative
  (recoverable only at placement time, i.e. Tier 2 territory).
- **Don't let the panel become a snapshot/history feature.** It's a decision
  overlay on the reset action. If it starts wanting "show me week-by-week
  inventory levels" it's drifted into the parked snapshots item — stop.
- **Migration discipline (Tier 1b):** link defaults to dev; push to prod only
  for the seconds it takes; relink to dev. The RPC swap is reversible (re-apply
  the current body) — but `supabase db reset` against a prod link is the failure
  mode the context file warns about.

### Done when

- The inventory editor shows, per product, trailing N-week demand in base units
  and a ⚠ marker on any product oversold in the window — all from existing
  tables, no new table.
- (Tier 1b) "Pre-fill from last week" seeds `qty_available` from `max-of-N`
  (or median+headroom), is idempotent, and a bestseller that sold out last week
  no longer gets restocked at its stockout ceiling.
- Playwright proves the marker + the seeding on multi-week seeded data; base-unit
  math is correct across a multi-unit product.
- Tier 2 (snapshot/timing) is written up as a separate issue, not built here.

### Kickoff

> Read `docs/ideas/2026-06-15-demand-aware-restock.md`. Implement **Tier 1
> only** (trailing-demand panel + ⚠ oversold marker, read-only) as a Phase 8
> task. Start by reading `src/app/(admin)/admin/inventory/page.tsx`
> (`weekItemsRes`), `src/components/admin/inventory-editor.tsx`,
> `src/components/admin/inventory-row.tsx`, and `src/lib/week.ts`, then
> `supabase/migrations/20260526182702_prepopulate_overwrite_qty_only.sql` for
> the current Pre-fill behavior. Propose the plan and the value of `N` before
> writing code. Hold Tier 1b (RPC reseed) and Tier 2 (snapshot) as separate
> follow-ups.

---

*Panel notes: survived the Skeptic as the strongest of three — a read-only
rollup over already-retained demand with a concrete trigger (the weekly reset)
and a sharp distinction from the parked "snapshots/history" item. The Architect
called it the cleanest possible fit (no new write path, no migration, first
honest consumer of the just-shipped base-unit conversion). Two rivals were
killed: a read-only oversold-reconciliation worksheet (the useful version
inevitably wants the mutate-existing-order RPC that doesn't exist — the trap a
prior round already flagged), and a mid-week "hasn't ordered yet" nudge surface
(obvious at 9 customers, and the anti-scale philosophy argues against automating
a glance). The Innovator found no outside tech that crossed cleanly tonight —
the only honest cross was a build-time one (lean on a Postgres-schema-rules
agent for the windowed rollup query + indexes), folded into the handoff.*
