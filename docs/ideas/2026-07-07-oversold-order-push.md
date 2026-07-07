# Tiller — the oversold-order alert: the one push worth interrupting Annabel for

**2026-07-07. Draft idea for Eric. Not for merge — you're the gate.**

Tonight's rotation landed on bushel. This is a pitch + an execute-ready build handoff.

---

## The idea

Phase 11 is building the mobile app's headline feature: **push Annabel on every new order.** That's the wrong event to lead with. The order that actually needs her — on a hard physical clock — is the **oversold** one, and it's a classification nobody has scoped.

Here's the asymmetry. A normal order needs nothing from Annabel until she packs it Wednesday. An **oversold** order (two customers grabbed the same last-of-something; `place_order` set `needs_reconciliation`) needs her *now*, because the window to fix it closes at Wednesday harvest — that's the last moment she can still text the customer, still reallocate stock, still decide who gets the 6 lb of tomatoes and who gets the apology. Miss it and she's reconciling in the field with a knife in her hand.

So: **make the order-arrival alert distinguish "new order" from "⚠ oversold — needs you," and make oversold the loud one.** A generic ping on all 20-odd weekly orders trains her to swipe them away; the oversold ping is the ~1-in-10 that's worth breaking her focus for. This is a *design correction on work already in flight*, not a new feature bolted on.

The cost is near zero because every piece already exists on the server:

- `place_order` already computes the oversold bit in-transaction (`v_negative`, `0001_init.sql:245`) and sets `needs_reconciliation`. It just **drops the flag on the way out** — `return query select v_order_id, v_appended` (line 253) never returns it.
- The admin alert already threads `appended` from that return through to a headline switch (`admin-alert-template.ts`). Adding `oversold` is byte-for-byte symmetric to `appended`.
- The mobile orders read (`listActiveOrders` → `/api/mobile/orders`) **already selects `needs_reconciliation`** on every row. The classification the mobile push fan-out needs is already in the payload it will read.

And it **ships value today**, not only when the Expo app lands. The alert channel that's live right now is Telegram (DEC-033), firing on every order. Threading the flag into *that* template — "⚠ OVERSOLD — Chef Mike, 10× tomatoes, $85" vs. "New order — Chef Mike, $85" — is a real upgrade to the channel Annabel uses today. The same flag then rides the `/api/mobile/orders` read and becomes the documented contract for the mobile push category. One small bushel PR delivers now **and** de-risks the cross-repo seam.

## Why it's worth it

It reframes what the mobile app's push is *for*. The Harvest & Pack sheet earned its keep by reaching into the Wed/Thu fulfillment days the software had abandoned; this reaches the same window from the alert side. The oversold decision is the single most time-critical event in the entire system — the only one bounded by a physical deadline that happens once a week and can't be rerun. Every other notification can wait; this one can't. Leading the app's push story with the generic new-order ping spends Annabel's attention on the events that don't need it and buries the one that does.

**Why now:** the push fan-out is being built *this phase*. The classification is cheapest to bake in before the notification category is designed, not retrofitted after. And the flag→alert plumbing on the web side is a change you'd want regardless of the app — it upgrades the live Telegram channel on its own.

## Why you haven't already

An ownership seam, not a decision. DEC-050 framed mobile push as a single "order-arrival" event — one undifferentiated ping. The oversold *classification* lives on the **bushel** side (`place_order` sets the flag), but the *fan-out* that would act on it lives in **bushel-mobile** (Phase 1, separate repo per DEC-052) — and the two repos were split at exactly the moment this work started. The signal-shaping falls in the crack between them: bushel computes the bit and throws it away at the RPC boundary; bushel-mobile will send a push but was never told there's a bit worth reading. Nobody owns the cross-repo contract, so the most valuable push in the system is the one nobody scoped. It's an absence by org-chart, not by judgment — nothing in SPEC or DECISIONS argues all orders deserve equal alarm.

---

## Build handoff

A self-contained bushel PR (~2 pts). Ships Telegram value immediately; leaves the mobile contract documented and the flag already on the wire. **No customer-facing change. No reduce/mutate path** — reconciliation stays fully human-by-text; this only *routes the signal*, it doesn't touch the resolution.

### Approach

Expose the oversold bit `place_order` already computes, thread it through the existing alert exactly as `appended` is threaded, render an oversold variant in the Telegram template, and document the same flag (already present on `/api/mobile/orders`) as the mobile push-category contract. Four small edits, one of them a trivial additive migration.

### File-by-file

1. **`db/migrations/0002_place_order_returns_flagged.sql`** (new migration — do **not** hand-patch `0001_init.sql`; the ledger tracks by filename and a re-run won't re-apply an edit).
   - `CREATE OR REPLACE FUNCTION public.place_order(...)` with the identical body except:
     - `RETURNS TABLE(order_id uuid, appended boolean, flagged boolean)`
     - final line: `return query select v_order_id, v_appended, v_negative;`
   - `v_negative` is already in scope and already computed at line 245. This is a two-token change to the signature + return. Copy the whole current function body verbatim from `0001_init.sql:34` onward so nothing else drifts.

2. **`src/actions/place-order.ts`** — the `query<{ order_id; appended }>` at line 68 widens to `{ order_id; appended; flagged }`; read `const flagged = rows[0]?.flagged ?? false` alongside `appended`; pass `oversold: flagged` into the `sendAdminOrderAlert({...})` call at line 112.

3. **`src/lib/notifications/admin-alert-template.ts`** — add `oversold?: boolean` to `AdminOrderAlertInput` (symmetric to `appended`). When `oversold`, prefix the headline with a marker and add a line — e.g. headline `⚠ OVERSOLD — ${customerName}, ${total}` and an explicit `Action: text ${customerName} before Wed harvest` line. Keep it plain text (Telegram renders links itself; DEC-033). The `appended`/`oversold` combination is legal (an append can push a line negative) — oversold wins the headline; keep the `appended` "Added"/"Items" labelling underneath.

4. **`src/app/api/mobile/orders/route.ts` + a short note in `docs/DECISIONS.md`** — no code change needed to the route (the read already carries `needs_reconciliation`). Add a one-paragraph contract note under DEC-050: *"bushel-mobile's order-arrival push MUST read `needs_reconciliation` and send oversold orders as a distinct high-priority notification category (`oversold`), copy: 'needs you before Wed harvest'. Generic new-order pushes use the default channel."* This is the cross-repo hand-off that closes the seam.

### Gotchas / risks

- **Migration discipline (DEC-046):** new numbered file, `CREATE OR REPLACE`, never edit `0001`. Re-baseline is not an option post-cutover — prod holds this function.
- **Don't recompute oversold anywhere else.** It's a server-set predicate (`qty_available < 0` across the order's products, `0001_init.sql:239-245`). The web alert, the mobile read, and any future consumer all read the one flag — never re-derive it from qty math client-side or in the app, or the two will disagree.
- **`vitest` pg-integration** (`db/tests/`, DEC-051): the existing `place_order` return-shape assertions will need the third column added. That's the regression net catching you correctly — update the expectation, don't route around it.
- **Bushel is off Supabase (Neon, DEC-049):** prod migration is the explicit-arg `npx tsx db/migrate.ts "$PROD_DATABASE_URL_UNPOOLED"` form. Ship the code behind the migration; the alert change is inert until the migration lands (old return shape → `flagged` reads `undefined` → `?? false` → no oversold pings, safe).
- **Scope tripwire:** if this starts wanting an in-app "reduce the line / clear the flag" button, **stop** — that's the reduce/restock/mutate-order primitive, a separate and much larger question that cuts against reconcile-by-text. This idea deliberately ends at *routing the signal to Annabel's thumb*; the resolution is her text, exactly as the philosophy intends. The bolder-but-still-clean version is a deep link from the push straight to the order detail with the customer's number primed for the SMS — the push carries the fix, and the fix is "text her."

### Done when

- Placing an oversold order (customer B orders past `qty_available`) fires a Telegram alert whose headline flags OVERSOLD and names the before-harvest action; a normal order fires the unchanged "New order" headline.
- `place_order` returns `(order_id, appended, flagged)`; `flagged` is true iff any product the order touched is now negative; `needs_reconciliation` behaviour is unchanged.
- `npm run test:unit` green (updated return-shape assertion + a new case asserting `flagged` on an oversell and the oversold alert-template branch).
- DECISIONS.md carries the bushel-mobile push-category contract note.
- No customer-facing surface changed; no new reduce/mutate write path introduced.

### Kickoff

> Read `docs/ideas/2026-07-07-oversold-order-push.md`. Implement the oversold-order alert: add migration `0002_place_order_returns_flagged.sql` (`CREATE OR REPLACE place_order` returning a third `flagged boolean` = the already-computed `v_negative`), thread `flagged` → `oversold` through `place-order.ts` into `sendAdminOrderAlert`, render an OVERSOLD headline + before-harvest action line in `admin-alert-template.ts`, and add the bushel-mobile oversold-push-category contract note under DEC-050 in DECISIONS.md. Update the `place_order` pg-integration return-shape test + add an oversell case. No customer-facing change, no reduce/mutate path. Spec it as a ~2-pt task, then plan before building.

---

*Panel: survived the Skeptic as the clear strongest of four; he killed a live customer-facing order-status tracker (the intermediate `confirmed`/`ready` states aren't driven — Annabel goes new→picked_up — so the tracker is dead UI, and package-tracking is the impersonal brain the project rejects) and a reduce/restock/clear-flag "reconcile-record" action (the mutate-order primitive twice-killed on prior nights, re-dressed; still cuts against reconcile-by-text). This one won because it's a payload distinction on a push already being built, targets the single time-critical event in the system, automates nothing about the human reconciliation, and ships value on the live Telegram channel today rather than waiting on the Expo app. The Architect confirmed the cleanest seam (widen the RPC return, thread the flag like `appended`, the mobile read already carries it) and mapped the files. The Visionary's steelman — the push deep-links to the order with the customer's number primed to text — is folded in as the bolder-but-clean endpoint. The Innovator found no outside tech that crosses bushel tonight: local-first/sync engines are ballast on a once-a-week form and Supabase Realtime is off-stack post-Neon; its one net-new (a Postgres-correctness review agent for the no-ORM codebase) was real but dev-workflow, not a farm-rhythm idea, and ranked below the product move.*
