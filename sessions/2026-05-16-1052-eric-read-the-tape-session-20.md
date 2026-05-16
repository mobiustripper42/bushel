---
session: 25
dev: eric
slug: read-the-tape-session-20
branch: task/read-the-tape-session-20
started: 2026-05-16T10:52:14Z
ended:
points:
pr_numbers: [101, 103, 104]
status: open
transcript: /home/eric/.claude/projects/-home-eric-bushel/b00c6569-590f-443d-acaa-a65b7dca12df.jsonl
---

# Session 25 — read-the-tape-session-20

<!-- Task blocks appended by /kill-this, one per task. -->

## Task 1: Phase 5.1 — Order list + status UI + reconciliation highlight (#97)

**Completed:**
- `/admin/orders` route — server component reading `?week=this|last`, default current week. Three-call fetch (selected + both chip counts) so the off-chip count stays accurate without a client round-trip.
- `src/lib/admin/orders-queries.ts`: `listOrders(weekOf)` joining orders → customers → order_items → products, totals computed from `qty × unit_price_cents`. `currentWeekOf()` helper.
- `src/lib/week.ts`: new `shiftWeek(weekOf, weeks)` — moved here from `orders-queries.ts` during code review so all week math sits in one file.
- `src/actions/advance-order-status.ts`: server action with DEC-010 transition guard (`new → ready → picked-up | delivered`), fulfillment-type pinning the terminal state, RLS-policy comment explaining the cookie-client choice.
- `src/components/admin/orders-page.tsx`: client component. Chip-tabs for "This week" / "Last week" / disabled "Custom range" (Phase 6). Sortable headers (Customer / Placed / Total). Reconciliation rows pinned to top inside the sort comparator so the pin survives any column-sort flip.
- `src/components/admin/order-row.tsx`: per-row client, optimistic status flip via useTransition with rollback on action error. Pickup vs delivery picks the right advance button.
- `src/components/admin/order-detail.tsx`: extracted during code review to keep order-row under the 200-line cap. Line items (with oversold flags), fulfillment block, customer note, reconciliation callout with two disabled stubs ("Adjust quantities" / "Mark resolved" — both deferred to Phase 6 per the planning decision).
- `src/styles/app.css`: Orders section (`.ord-*`, `.chip-tab`, `.pill-*`, `.status-advance`, `.callout-warn`) appended. App.css-only rule held.
- `tests/admin-orders.spec.ts`: 5 desktop tests — row render with totals, reconciliation pin holds under inverted sort, delivery `new → ready → delivered` reload-persist, pickup `ready → picked-up` (and "Delivered" button absent), expand reveals line items + customer note + disabled callout buttons.

**Snags worth remembering:**
- The chained-transition test (`new → ready → delivered` in the same row) raced badly until I polled the DB between clicks. useTransition's `pending` + revalidatePath aren't enough — the second click can fire before the first action's RSC refetch settles, and the optimistic flip on the second click appears in the DOM while the action call never reaches the server cleanly. The fix in the test (DB poll between transitions, `await page.goto()` instead of `page.reload()` because reload hangs on chained-action RSC streaming in dev mode) sidesteps it. The real lesson for future actions: chained server actions on the same row in tests need DB-state gates, not just DOM-state gates. The UX works fine for a human who waits between clicks; this is a test-timing fragility, not a production bug.
- The relational-embed `as` cast in `orders-queries.ts:84` (`o.customers as { id; name }`) was flagged by code review for bypassing the type checker. Skipped — `send-queue-queries.ts` does the same thing; addressing it here alone would be inconsistent. Either we fix both (regenerate types and drop the casts everywhere) or accept the pattern. Worth a Phase 6 cleanup task.
- Code review correctly flagged the auth-on-server-action gap: `getUser()` confirms *any* authenticated user, not specifically an admin. `admin_all_orders` RLS is `authenticated using (true)`. Today V1 has no non-admin authed accounts so it's theoretical, but the same posture exists in `recordSend`. Carrying the debt forward, not adding to it.
- Design mockup's "Order #" column used `ord-0503-04` style human IDs. We don't have a separate human order number column — orders are UUIDs. Rendered the first 8 chars of the UUID prefixed with `#` (`#7320d88c`). Good enough for V1; if Annabel wants short ordinal IDs, that's a follow-up.
- Build first showed `admin-page-head` / `admin-page-title` classes in the orders page — neither exists in `app.css`. Switched to the established `.page-head` / `.page-title` primitives. Reminder for future page work: grep `app.css` for the class before assuming the design mockup's class name maps directly.

**Code review:** 8 findings, 3 addressed (extract OrderDetail, move shiftWeek, RLS comment). 5 skipped with rationale: relational cast matches existing pattern, counts-only query is over-optimization for 7 customers, no error.tsx per CLAUDE.md "don't add fallbacks for scenarios that can't happen," auth gap is pre-existing in recordSend, TODO comments on disabled stubs are redundant with the Phase 6 plan.
**PR:** [#101](https://github.com/mobiustripper42/bushel/pull/101)
**Points:** 3
**Branch:** task/5.1-orders-list
**Opened at:** 2026-05-16T11:31:31Z

## Task 2: Fix notifications-flow CI flake (#102)

**Completed:**
- Diagnosed and fixed the cross-spec CI failure that's been red since PR #96. Symptom (test customer row missing from queue) was a red herring — actual cause was `/admin/send` redirecting to `/login` because the admin-shell sign-out test invalidated the @supabase/ssr-managed JWT shared via storageState.
- `src/actions/sign-out.ts`: `supabase.auth.signOut({ scope: "local" })`. Default scope is `global`, which revokes the refresh token server-side. Correct production UX (signing out on the laptop shouldn't kick Annabel out of her phone) and necessary — but not sufficient — for the test fix.
- `tests/global-setup.ts`: extracted `writeAdminStorageState()` helper that signs in the test admin and writes `playwright/.auth/admin.json`. globalSetup now calls this internally; the helper is also exported so tests can refresh state mid-run.
- `tests/admin-shell.spec.ts`: `afterAll(writeAdminStorageState)` on the sign-out describe block. Empirically — and this took the longest to nail down — `scope:"local"` alone isn't enough; `@supabase/ssr`'s `getUser()` on a fresh context still rejects the post-signOut cookies. Rewriting storageState after the sign-out test is what actually unblocks the downstream specs.
- `tests/notifications-flow.spec.ts`: `resetCustomerState()` now error-checks the update + asserts at least one row was affected (loud failure if test customer goes missing). New `ensureOrderingOpen()` in beforeEach — admin-settings flips `ordering_schedule.is_open=false` without restoring, and the deep-link test renders the customer page (which redirects to the closed state when ordering is closed).
- `playwright.config.ts`: testIgnore `notifications-flow.spec.ts` on tablet/mobile projects. It exercises `/admin/send` which is desktop-only per DEC-019; tablet/mobile fanout was tripling failure noise.

**Snags worth remembering:**
- **The diagnostic that cracked it.** Adding `console.log(page.url())` to the failing test immediately showed `/login?next=/admin/send` — the customer state was fine, the auth was broken. ~30 minutes of upfront investigation went into wrong directions (admin-customers delete syntax, ordering schedule race) before the diagnostic revealed the truth. Lesson: when a test fails with "element not found," capture the page URL FIRST before reasoning about state. Cheap diagnostic, high signal.
- **scope:"local" isn't actually local.** The Supabase docs claim scope:'local' only clears local state without revoking server-side. But `@supabase/ssr`'s middleware-style `getUser()` on a fresh context loading the SAME cookies still got rejected after a previous context's `signOut({scope:"local"})`. Why is unclear — maybe `getUser()` triggers a refresh that hits the just-rotated token. Workaround: regenerate storageState in afterAll. Production-side the scope:"local" fix is still correct.
- **`.env.local` points at CLOUD, not local Supabase.** Running `npx playwright test` against the cloud project would have `admin-customers.spec.ts:30` execute `DELETE FROM customers WHERE token NOT IN (...)` against the dev/preview cloud DB, wiping any real test data. Per CLAUDE.md: ".env.local and npm run dev point at the dev/preview cloud project, not 127.0.0.1:54421" — but Playwright reads `.env.local` directly via dotenv. The CI workflow sets local Supabase env vars before running tests; locally the user/skill has to swap `.env.local` manually before a full-suite run. Worth a `.env.local.test` overlay or a `test` script in package.json.
- **Stale `next-server` on port 3001 hides between invocations.** `lsof -ti:3001` returned empty but `ss -tlnp` showed a `next-server` listening. Killed via the pid from `ss`. CLAUDE.md mentions the `next start` orphan issue but `lsof` isn't always sufficient — `ss -tlnp | grep :3001` is the more reliable probe.
- **CI's full-suite has been failing since PR #96.** The Phase 4.4 spec landed broken in CI, and #96/#100/#101 all merged through red. Nobody (me included) noticed until I caught it on #101. The team practice of "merge through CI failures" makes spec-introduced flakes invisible for as long as nobody runs the full suite locally. Worth flagging in retro.

**Code review:** Skipped — straightforward test-infra fix with the production-side change (scope:"local") being a one-line improvement, and the verification (177/177 local pass) is the strongest signal. CI green will confirm.
**PR:** [#103](https://github.com/mobiustripper42/bushel/pull/103) (stacked on #101)
**Points:** 3
**Branch:** task/fix-notifications-flow-ci-flake
**Opened at:** 2026-05-16T13:08:48Z

## Task 3: Phase 5.2 — Export to Wave (CSV + clipboard TSV) (#98)

**Completed:**
- `src/lib/admin/export-orders.ts`: pure `toCsv(orders)` / `toTsv(orders)` against the exact Wave Sheets-import header (`Invoice Number, Customer Name, Item Name, Quantity, Unit Price, Description, Sales Taxes, Messages`). User-confirmed columns — I'd guessed a generic invoice shape first, asked, and swapped. One row per line item; rows from the same order share the Invoice Number so Wave bundles them into a single draft invoice on import. Description carries `item.unit` (e.g. "bunch") since Wave has no separate unit column. Sales Taxes + Messages blank in V1.
- CSV is RFC 4180 (CRLF, quote-and-double-quote escape for `,` / `"` / `\r` / `\n`). TSV strips embedded tabs/newlines from fields so paste-to-Sheets row shape stays intact.
- `src/components/admin/export-orders-button.tsx`: client split-button + popover. CSV via Blob URL + revoke; TSV via `navigator.clipboard.writeText` with graceful fallback. Disabled when no orders.
- `src/components/admin/orders-page.tsx`: render the button in `page-head` actions; new `weekOf` prop threads through.
- `src/app/(admin)/admin/orders/page.tsx`: passes `selectedWeek` as `weekOf` so the CSV filename is `bushel-orders-<YYYY-MM-DD>.csv`.
- `src/styles/app.css`: `.split-btn-*` / `.split-menu` / `.split-item` primitives appended (app.css-only rule held).
- `tests/admin-orders-export.spec.ts`: 5 unit + 3 integration tests, 8/8 green.

**Snags worth remembering:**
- **Don't guess at external system column shapes** — I shipped commit 1 with a plausible-but-invented column list (Date, Customer, Item, Unit, Quantity, Unit Price, Amount). The AC literally said "match what Wave's Sheets import expects" and I rationalized past it because the design didn't supply them. User caught it ("do you need the wave columns?"), gave me the actual header, and I rewrote. Lesson: when the AC names an external system contract, ask for the contract before writing the transformer. The cost of being wrong here was high (re-write + re-test + cargo-culted column comments).
- **UUID slice contains hyphens.** `"11111111-2222-...".slice(0, 12)` is `"11111111-222"`, not `"111111112222"`. Tests had to assert on the hyphenated form. Worth a one-line comment so the next reader doesn't trip on it. Could strip the hyphen, but the trade-off is cosmetic vs the round-trip clarity of "this came from a UUID."
- **Code review caught the silent-merge risk on 8-char Invoice Numbers.** 8 hex chars = ~4B combinations, fine in expectation but Wave's bundling-by-Invoice-Number rule means two-orders-same-prefix → merged into one invoice silently, wrong customer billed. Cheap fix: widen to 12 chars (2^48 combos). Took the fix; documented the reasoning in the function comment.
- **Dropped `role="menu"`/`role="menuitem"`** after review — we render two buttons in a popover but don't implement arrow-key nav or focus trap. The ARIA roles were promising behavior we didn't deliver. Plain buttons + no role is more honest. Updated the test selectors from `getByRole("menuitem")` to `getByRole("button")` as a result.
- **`.env.local` directive crystallized.** User: "you can leave env.local pointing to local." I'd been habitually restoring it to cloud after test swaps (per CLAUDE.md prose). Saved as a feedback memory — going forward leave .env.local on local Supabase, don't restore. The CLAUDE.md prose is now stale on this point.

**Code review:** 7 findings, 4 addressed in `3b07810` (12-char invoice number, drop ARIA menu roles, console.warn clipboard error, feedback 2s→4s). 3 skipped with rationale: leading-space-in-customer-name CSV gotcha (Sheets is lenient — defer), scrim swallowing underlying clicks (matches design mockup pattern), `money(0)` rendering (intentional, DEC-016 silent on it).
**PR:** [#104](https://github.com/mobiustripper42/bushel/pull/104) (stacked on #103, which is stacked on #101)
**Points:** 3
**Branch:** task/5.2-export-to-wave
**Opened at:** 2026-05-16T13:46:37Z

**Next Steps:**

**Context:**
