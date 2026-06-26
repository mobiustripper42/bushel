# Tiller idea — "Your usual": customer-side repeat-order prefill

*Tiller, 2026-06-26. Draft only; Eric is the gate. Not for merge.*

Tonight's rotation landed on bushel. Mid-Phase 9 (open-order pivot) — a good
moment, because the pivot is exactly what makes this safe to build *and* exactly
what makes it dangerous if built naively. Both are below.

---

## The idea

The admin has had **"Pre-fill from last week"** since Phase 2 — Annabel taps it
and her inventory resets to last week's shape so she isn't retyping 12 products
every Sunday. The customer side has the *identical* weekly chore and **no such
button**: a restaurant chef opens `/c/<token>` to an **empty cart** every single
week and re-enters a basket that barely changes — "10 lb mixed greens, 4 pints
cherry tomatoes, 6 bunches chard" — by hand, on a phone.

Add the customer-side mirror: a **"Start from last week" / "Your usual"** action on
the order page that seeds the form's quantities *and* unit selections from the
customer's most recent prior order, **clamped to this week's availability** (drop
products/units that are gone or sold out, clamp qty to stock). One tap → the cart
is 90% filled → they adjust and submit through the normal `place_order` path.

It is a **read-only query + a client-side prefill**. No migration, no new write
path, no RLS change. The prior-order read is one `select`; the "drop stale lines"
logic already exists (the #149 draft-hydration clamp). The whole feature is the
admin's `prepopulate` button, pointed at the customer.

**One hard guard, non-negotiable (see Gotchas):** prefill is offered **only on the
compose-from-scratch path** — when the customer has *no* open order yet this week.
In add-mode (`?add=1`), the button is **hidden**, because `place_order` is now
additive-only and seeding a prior basket as new lines would *append* it, silently
doubling the order. The open-order pivot is what makes "your usual" both possible
and a footgun; the guard is what separates the two.

---

## Why it's worth it

- **It's the highest-friction recurring moment for the exact user the app is for.**
  Bushel's thesis is "be the easy way to order from a friend." For a stable-basket
  wholesale buyer, the empty cart every week *is* the friction — and it's the one
  recurring point where a chef shrugs and just texts Annabel the order instead,
  quietly eroding the app's reason to exist. Prefill makes the app the path of
  least resistance for the buyer it was built around. This isn't a revenue lever
  (it can't be, at 9 customers, and shouldn't pretend to be) — it's a
  habit/retention argument, and it's on-philosophy.

- **The fit is unusually tight.** Generic "buy again" is template-grade noise on a
  consumer store — people buy different things every visit. B2B wholesale baskets
  are *stable week over week*, so the prior order is a genuinely high-quality
  default, not a guess. The feature is generic; the **hit rate is bushel-specific.**

- **Why now:** the open-order pivot (Phase 9) just made "the customer's last order"
  a clean, durable concept — orders persist as rows keyed to the customer, no
  longer transient week-scoped identity. And the add-mode work already proved the
  form can hydrate from an order server-side. The machinery is half-built; this
  draws the symmetry the admin side got two phases ago.

## Why you haven't already

Honest reason: **asymmetry of attention, not a decision.** The admin got
`prepopulate` because Annabel's pain was *visible to the builder* — she's the user
in the room. The customer's identical pain happens on someone else's phone,
off-system, so it never surfaced as a design driver. Nothing in SPEC or DECISIONS
argues the customer cart should stay blank.

Two artifacts *look* like prohibitions and aren't:

- **DEC-015** ("customer edits = text Annabel") governs editing a *placed* order.
  Prefill happens at *compose* time, before placement — it seeds a draft the
  customer reviews and submits normally. It touches nothing DEC-015 protects.
- **#136** (customer order history) is scoped read-only, "no re-order." That's a
  scope note on *one screen* (history shows, doesn't act) — not a product-wide ban.
  Prefilling the compose form is a different surface. In fact #136 *disclaims* the
  valuable half (re-order) while keeping the less-valuable half (passive viewing).

So it reads as already-decided-against when it was only never-looked-at. That's
the credibility tell: the block is real-feeling and false.

---

## Build handoff

A contained feature — file-by-file below. Roughly a **3-pt Phase 9/backlog issue.**

### Approach

Three pieces: (1) a read query for the customer's most recent prior order's lines;
(2) a server-page gate that only offers prefill when there's no open order this
week; (3) a client prefill that seeds the form's `qty`/`selectedUnit` state,
clamped to current availability, reusing the existing stale-line clamp.

Key decisions, with reasoning:

- **Literal last order, not "most-frequent basket."** V1 is the customer's *single
  most recent* order. A trailing most-frequent-across-N basket is the obvious
  bolder version (robust to a one-off odd week) — but it's a ranking heuristic that
  wants its own validation, and "last order" is honest, legible ("this is what you
  got last time"), and already a high hit rate for stable buyers. Ship literal;
  park most-frequent as the follow-on (note it in `OPEN_ITEMS.md`).

- **Clamp at prefill, let optimistic placement own the race.** Drop lines whose
  product is no longer `is_active`/`is_available`, whose chosen unit is gone, or
  whose unit no longer fits stock (`qty_available < conversion_to_base`); clamp a
  surviving line's qty to what's available. Don't try to make prefill race-proof
  against a mid-session stock drop — `place_order` already handles concurrent
  oversell for the empty-cart case (DEC-012/DEC-036); prefill adds volume to that
  existing race, not a new one.

- **Prefill is a draft source, not a new persistence layer.** It writes into the
  same `qty`/`selectedUnit` state the sessionStorage draft (#149) already manages.
  That's the reuse that makes this cheap.

### File-by-file

- **`src/lib/customer/queries.ts`** — add `getMostRecentOrder(customerId)`: the
  same shape as `getCurrentWeekOrder` but **no `week_of` filter**, `order by
  created_at desc limit 1`, `maybeSingle()`. Select `order_items(qty,
  product_id, product_unit_id, ...)` — you need `product_id` + `product_unit_id`
  to re-seed the form (the `getCurrentWeekOrder` select joins names for display;
  this one needs IDs for matching). Returns `null` for a first-time customer.

- **`src/app/c/[token]/page.tsx`** — the gate is *already computed here.* The page
  already loads `existingOrder` (this week's open order) and derives `addMode`.
  - Compute `canPrefill = !existingOrder` (no open order this week) **and not**
    `addMode`. (Belt and suspenders: `addMode` already implies `existingOrder`, but
    state both so the intent is legible and a future refactor can't quietly break
    it.)
  - When `canPrefill`, call `getMostRecentOrder(customer.id)` and map its lines
    against the freshly-loaded `products` to a `prefillItems` array of
    `{ product_id, product_unit_id, qty }`, **dropping** lines whose product isn't
    in `products`, whose unit isn't in that product's active `units`, or where the
    unit doesn't fit stock; **clamp** qty to `floor(qty_available /
    conversion_to_base)`. Pass `prefillItems` (possibly empty) to `OrderForm`.
  - Pass nothing in add-mode — the prop stays `null`.

- **`src/components/customer/OrderForm.tsx`** — add an optional
  `prefillItems?: { product_id: string; product_unit_id: string; qty: number }[]`
  prop. Render a **"Start from last week" / "Your usual"** button **only when
  `prefillItems?.length` and the cart is currently empty** (no qty set, no restored
  draft). On tap: set `selectedUnit[product_id] = product_unit_id` and
  `qty[product_id] = qty` for each line, then let the existing total/preview recompute.
  - **Confirm-before-clobber:** if a sessionStorage draft was restored (cart is
    *not* empty), either hide the button or gate it behind the existing
    `ConfirmModal` ("Replace your in-progress cart with last week's order?"). Do not
    silently stomp a draft the customer was mid-way through.
  - The button is one-shot UI sugar; it sets state the form already owns. It does
    **not** touch the submit payload shape — submit still goes through `placeOrder`
    unchanged.

- **`tests/` (Playwright)** — a `prefill.spec.ts`: seed a prior order for a test
  customer, load `/c/<token>` in a fresh week, assert the button appears, tap it,
  assert quantities/units match (minus a deliberately-sold-out line that should be
  dropped), submit, assert the order lands. Add a case asserting the button is
  **absent** in `?add=1` add-mode. Customer-side → run mobile/webkit projects
  (DEC-019 / Workflow Override), 375px.

### Gotchas / risks

- **THE bug — add-mode double-order.** This is the whole reason the feature is
  3 pts not 1. Order identity is now the open order and `place_order` is
  **additive-only**. If "your usual" is ever reachable while the customer has an
  open order this week, tapping it seeds the prior basket as *new lines* and the
  append doubles the order / over-decrements stock. **Mitigation is structural, not
  a warning string:** the button only exists on the no-open-order compose path;
  it is not rendered in add-mode. Verify with the absent-in-add-mode test above.
- **Don't sum raw qty across units / don't trust a stale unit.** Match each prior
  line's `product_unit_id` against the product's *current* active `units`; a unit
  that was deleted or made inactive (units drawer, DEC-037/DEC-038) must drop, not
  prefill a dangling FK.
- **Clamp uses base-unit math.** A unit fits only if `qty_available >=
  conversion_to_base`; max qty is `floor(qty_available / conversion_to_base)`.
  Reuse `anyOrderable`'s predicate shape so the two can't drift.
- **Empty result is normal.** First-time customer, or every prior line is now
  unavailable → `prefillItems` is empty → no button. Not an error state.
- **Draft collision.** The #149 sessionStorage draft and a prefill both write
  `qty`/`selectedUnit`. Decide one owner on load: a restored draft wins (it's the
  customer's *more recent* intent), and prefill is offered only behind confirm. Do
  not let mount-order decide it by accident.

### Done when

- A returning customer with a stable prior order sees "Your usual," taps once, and
  lands on a cart matching last order minus anything now unavailable — then submits
  through the normal path.
- The button never appears in add-mode (`?add=1`), and a Playwright test proves it.
- A dirty/restored draft is never silently overwritten.
- First-time customers and all-stale-prior-basket customers simply see no button.
- No migration, no RLS change, no new write path landed.

### Kickoff (paste-ready)

> Implement customer-side "Your usual" repeat-order prefill on `/c/[token]`, per
> `docs/ideas/2026-06-26-customer-your-usual-prefill.md`. Add
> `getMostRecentOrder(customerId)` to `src/lib/customer/queries.ts`; gate prefill in
> `src/app/c/[token]/page.tsx` to the no-open-order compose path only (hard-disable
> in add-mode); add a `prefillItems` prop + "Start from last week" button to
> `OrderForm.tsx` that seeds qty/unit clamped to current availability and confirms
> before clobbering a restored draft. Read-only — no migration, no new write path.
> Write `tests/prefill.spec.ts` including the button-absent-in-add-mode case
> (mobile/webkit, 375px). Start by reading the doc, then plan before coding.

---

*Panel: survived the Skeptic as strongest of three — it clears the "why not already"
gate (attention asymmetry, no real prohibition; DEC-015 and #136 only look like
blocks), and the stable-basket fit makes a generic mechanism land sharp here. The
Skeptic's real hit reshaped the scope, not the verdict: the open-order/add-mode
collision is a live double-order bug, so prefill is gated to the compose-from-
scratch path — that guard is baked into the handoff above. Killed: a two-way
Telegram "reply to act on the order alert" (new inbound write path with a spoofing/
trust boundary to spec — a meatier task, not this) and an admin tool to clear the
never-cleared `needs_reconciliation` flag (real standing debt, but it needs a
reduce/restock mutate-order RPC that doesn't exist and cuts against the deliberate
"reconcile by text" philosophy). The Innovator found no outside tech that crosses
cleanly — and made the point that "your usual" is *better* as plain SQL than with
any local-first sync runtime (Zero/Electric/TanStack DB would be ballast on a form
loaded once a week on cell signal), and that the parked realtime flag (#53) should
stay parked.*
