# The Harvest & Pack Sheet — the document that runs Wednesday and Thursday

*Tiller proposal · 2026-06-04 · bushel*

## The idea

When the ordering week closes, Bushel already holds every byte needed to
produce the one document the farm actually runs on for the next two days — and
it produces nothing. Add an **order-close fulfillment view** that derives two
artifacts from `order_items`, the data already owned: (1) a **consolidated
harvest list** — the total of each product summed across every order for the
week, folded through `product_units.conversion_to_base` into a single base-unit
figure ("harvest 14 lb basil, 9 bunches chard, 22 dozen eggs"); and (2)
**per-customer packing slips** — the same join grouped by customer, the
check-against-the-box sheet for Thursday. It's a read-only rollup: a `SUM ...
GROUP BY` over `order_items → product_units → products` for the current
`week_of`, rendered as a Server Component with a `@media print` block in
`app.css`. No new tables, no new write surface, no RLS change — admin already
reads all `order_items`. Two refinements make it the real thing rather than a
report: sort the harvest list by a `harvest_zone`/sequence so it reads as a
**pick-walk** Annabel follows once through the field top-to-bottom, not a
spreadsheet she re-sorts in her head; and **regenerate it live on every view**
rather than freezing a snapshot, so when she resolves an oversell Tuesday night
(trims an order, texts the customer) the harvest total and the slips both move
with the correction and the paper never lies about what's in the box.

## Why it's worth it

This is the only change that reaches *into* the two days that are the entire
point of the farm and that the software currently abandons. Today the app's
last act is the Wave CSV export — it stops at accounting. The physical work,
harvest Wednesday and pack/deliver Thursday, runs on Annabel's memory and a
clipboard: she eyeballs individual orders and transcribes a pick total by hand,
under time pressure, on harvest morning — the highest-stakes off-system moment
in the week and the exact place a `needs_reconciliation` oversell turns into a
wrong box. The leverage is steep and the cost is shallow: it's a query and a
print view over data already in the database, no new dependency, no new
regulatory or inventory-correctness surface, and it reuses the same base-unit
conversion math `place_order` already runs on decrement. "Why now" is concrete
— **multi-unit products with base-unit conversion just shipped.** Before that,
summing "3 bunches + 2 lb + 1 case" of the same product across orders into one
trustworthy pick number was garbage-in. The conversion layer is days old; it's
what makes the cross-order sum honest for the first time.

## Why you haven't already

Two reasons, both honest. First, the project framed itself end-to-end as an
*ordering + accounting* system — intake on one side, Wave export on the other —
so the fulfillment days quietly fell off the map as "the part that lives on
paper." It's an absence by framing, not by decision: nothing in SPEC or
DECISIONS argues the harvest step should stay manual; it was simply never the
thing being built. Second, the data only just became clean enough to trust.
The cross-order harvest sum is meaningless until mixed units reconcile to a
base unit, and that landed in the multi-unit epic that closed at the end of
Phase 7. The idea couldn't have earned its keep a month ago; it can now.

## How to start

1. **One read query, in SQL where the aggregation belongs:** a view or thin
   read-only function returning `product_id, name, sum(qty * conversion_to_base)
   as base_qty` joined `order_items → product_units → products`, filtered to
   `week_of = weekOfMondayNY()`. Decide per-product whether to display the base
   unit or back-convert to a chosen picking unit — and **fold through
   `conversion_to_base`; never sum raw `qty` across mixed units** (the one trap
   the Architect flagged: 3 bunches + 2 lb ≠ "5").
2. **A `/admin/fulfillment` (or a tab on `/admin/orders`) Server Component** that
   renders the harvest list first, packing slips below, regenerated on each
   load so reconciliation stays reflected. Print styling in `app.css` under a
   labeled `@media print` section.
3. **Stop there.** Keep it print/PDF-static — no harvested-yes/no toggles, no
   partial-pack state, no field check-off. The moment it wants live state back
   *from* the field it has quietly become a warehouse app; that's a different
   project. This is a document, generated from owned data, dumb after it prints.

A natural Phase 8 issue at ~3 pts. The pick-walk ordering (`harvest_zone` on
`products`) can be a follow-on once the plain sum is in Annabel's hands and she
says which order she actually walks the field in.
