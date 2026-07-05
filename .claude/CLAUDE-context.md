# bushel — Project Context

Everything specific to **bushel**. The seeds-managed `CLAUDE.md` shell reads this file at session start and treats it as authoritative for project-specific facts. Nothing here syncs from seeds — it's yours to edit freely (DEC-S019).

## ⚠ READ FIRST — Design folder is authoritative for ALL UI work

The `/design/` directory at the repo root contains hand-built JSX + CSS + HTML mockups for every page. Filenames match routes (`admin-inventory.jsx` ↔ `/admin/inventory`, `admin-customers.jsx` ↔ `/admin/customers`, `order-page.jsx` ↔ `/c/[token]`, etc.).

**Before writing or modifying ANY file under `src/app/`, `src/components/admin/`, or `src/components/customer/`:**

1. `ls design/` and identify the matching mockup
2. Open the `.jsx` AND its companion `.css` if one exists
3. Read both fully — the JSX defines structure + interaction, the CSS defines visual tokens
4. Match the design's layout, controls, and dirty-state behavior — do not "simplify"
5. If no design file exists for the page, **stop and ask** before inventing layout

The mockups are the spec. Acceptance criteria in Issues + the design file together define done. Shipping a page that matches the AC but ignores the design is a rebuild, not a fix.

This has been missed in prior sessions. Do not miss it again.

## What We're Building

Bay Branch Farm Inventory & Order System (`order.baybranchfarm.com`). Replaces tend.com for ~7 B2B customers (2 farm stands, 1 grocery store, 3–4 restaurants) on a weekly Sun/Mon → Wed/Thu cadence.

Roles:
- **Admin** — Annabel. Manages inventory, customers, orders, send notifications.
- **Customer (B2B)** — receives weekly SMS link, places order through tokenized URL.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript strict, sailbook-style CSS (DEC-021)
- **Backend:** Neon Postgres via `pg` + hand-rolled SQL migration runner (DEC-046) — no separate API server. Access boundary is the service layer, not RLS (DEC-048).
- **Auth:** self-rolled email→code→HMAC session (DEC-047) — no Supabase Auth, no Google OAuth. Login codes emailed via Resend.
- **Notifications:** Operator-sent customer SMS via native `sms:` deep links — no third-party SMS provider (DEC-026). Admin order-arrival alert via transactional email (DEC-027); PWA push as stretch upgrade.
- **Hosting:** Vercel (frontend), Neon (Postgres — one project, `main` + `production` branches, DEC-049). Docker Postgres locally + CI.
- **Testing:** vitest (unit + pg-integration, DEC-051), Playwright (E2E, mobile/tablet/desktop), axe-core (a11y). pgTAP + Supabase retired.
- **Domain:** `order.baybranchfarm.com` (CNAME → Vercel); apex stays Astro/Netlify

## Core Data Model (target — see Phase 1.1)

```
products → order_items
customers (token, contact, send_weekly_link) → orders → order_items
orders.needs_reconciliation (oversold flag)
orders.pickup_note, orders.delivery_preference (DEC-029: free-text fulfillment, no structured pickup windows in V1)
ordering_schedule (is_open default true per DEC-030)
```

Schema details land in Phase 1.1 (sketched in plan; finalize at execution).

## Commands
```bash
# Development
npm run dev
npm run build
npm run lint

# Database (docker Postgres — DEC-046)
npm run db:up                                   # docker compose up (bushel_dev + bushel_test on :5433)
npm run db:down
npm run db:migrate                              # apply db/migrations/*.sql to DATABASE_URL (or explicit arg)
# new migration: add db/migrations/NNNN_<name>.sql (next number), then db:migrate
# prod migrate is ALWAYS the explicit-arg form (DEC-049): npx tsx db/migrate.ts "$DATABASE_URL_UNPOOLED"

# Testing
npm run test:unit                               # vitest: unit + pg-integration (DEC-051; needs docker pg for the integration files, skips them if down)
npm run test:watch                              # vitest watch
npx playwright test                             # full E2E suite (workers=1 by config — do not override)
npx playwright test tests/foo.spec.ts --project=desktop  # targeted, dev mode
npx playwright test --ui                        # browser UI
```

## Additional Docs
Project-specific docs beyond the baseline `## Key Docs` table in the shell:

| File | Purpose |
|------|-------|
| `docs/SPEC.md` | Scope is V1 vs **V1.5** vs V2 (bushel-specific phasing) |
| `docs/SCHEMA.md` | Finalized table shapes; gates migrations |
| `docs/DECISIONS.md` | bushel decisions run DEC-001…DEC-032 (project-own; distinct from seeds' DEC-S### refs) |
| `docs/USER_STORIES.md` | B2B-reframed; pending review |
| `docs/AGENTS.md` | The repo-root `AGENTS.md` is a Next.js-agent rules stub for IDE tooling — **not** the project agent doc; `docs/AGENTS.md` is canonical |
| `docs/BRAND.md` | Voice, type, color |

## Workflow Overrides
Overrides to the shell's `## Micro Workflow` (customer-side is mobile-prioritized):
- **Step 5/6 testing** — Playwright (E2E) + vitest (unit for pure logic, pg-integration for DB functions/constraints/triggers — DEC-051); also run mobile/webkit projects for customer-side changes, not just desktop.
- **Step 7 mobile screenshot** — confirm 375px specifically for the customer-side.

## Migration Protocol (project)
The migration **discipline** lives in the shell's `## Migration Protocol`. bushel's toolchain:

**All schema changes go through `db/migrations/NNNN_<name>.sql`.** Hand-rolled SQL, applied in filename order by `db/migrate.ts`, tracked in a `_migrations` table so re-runs are no-ops. No framework, no dashboard edits.

- New migration: add `db/migrations/NNNN_<name>.sql` (next number in sequence).
- Apply to docker dev: `npm run db:migrate` (defaults to the local compose service).
- **Never hand-patch an already-applied migration** — a re-run won't re-apply it (the ledger tracks by name), so the file silently diverges from the DB. Edit one only if you also re-baseline every DB that holds it (`drop schema public cascade` + re-migrate), and only while no real data exists.
- Before creating: `gh pr list` for open PRs touching the same tables; merge in-flight first or bump the number to keep the ledger ordered.
- **Use the UNPOOLED/direct endpoint for migrations.** DDL runs in a transaction and Neon's pooled endpoint is PgBouncer (transaction mode), which can mangle it. The app reads the pooled `DATABASE_URL` at runtime; migrations take `DATABASE_URL_UNPOOLED`.

### Neon branch model (DEC-049)

One Neon project, two branches — `production` is a downstream deploy pointer, never a PR base:

| Branch | Used by |
|--------|---------|
| `main` | Vercel Preview + Development scopes; backs the deployed **preview** app |
| `production` | Vercel Production scope only — `order.baybranchfarm.com` |

Local dev + CI + Playwright + vitest run against **docker Postgres** (`bushel_dev` / `bushel_test` on :5433), not Neon. Neon `main` backs the deployed preview; Neon `production` is empty until the 10.7 cutover.

**Prod-write protection (DEC-049)** — the prod DB URL lives ONLY in Vercel and a deliberately-sourced `.envrc.production` (gitignored), never the shell default. A prod migration is an explicit-arg `npx tsx db/migrate.ts "$PROD_DATABASE_URL"` (use the direct/unpooled endpoint — DDL in a transaction) — there is no default-prod state to forget out of, so no relink dance. Strictly safer than the old Supabase link/relink ritual it replaced.

### Env vars (`.env.local`) + Vercel ↔ Neon sync

All env lives in `.env.local` for day-to-day dev/test (DEC-049; Next + Playwright auto-load it via dotenv) — no `.envrc`/direnv. The one exception is the gitignored `.envrc.production`, sourced deliberately only for a prod migration (see Prod-write protection above). Keys in `.env.local`:
- `DATABASE_URL` — pooled Neon `main`, app runtime.
- `DATABASE_URL_UNPOOLED` — direct Neon `main`, migrations (pooled = PgBouncer transaction mode, mangles DDL transactions).
- `RESEND_API_KEY` + `RESEND_FROM` — login-code email. FROM must be `@brewcle.com` (the verified Resend domain; the `crew-tips` subdomain is NOT verified → 403). Sends ride the brewcle Resend account (DEC-047).
- `SESSION_SECRET` — HMAC session signing key (`openssl rand -hex 32`); required in prod (fails fast if unset).

Test tooling deliberately does NOT read `.env.local`'s `DATABASE_URL`: vitest integration + Playwright target docker `bushel_test` explicitly (a run truncates data — pointing it at the dev DB would wipe it).

**Vercel ↔ Neon:** Vercel env vars don't auto-sync with Neon branch URLs. Production scope → Neon `production` branch URL; Preview + Development + `.env.local` → Neon `main` branch URL. The per-scope vars must stay coherent. Sharp edges — CLI can't add unbranched Preview vars; a wrong branch URL 500s every DB route; a malformed paste surfaces as `ENOTFOUND` on a nonsense host — are in the `vercel-preview-env-gotchas` memory. Vercel doesn't redeploy on env change; trigger one after edits.

Failure modes:
- **Missing/undefined `DATABASE_URL`** → the pg pool falls back to the localhost default and 500s every DB route on the deployed site (local `npm run dev` reads `.env.local`, masking it).
- **Wrong Neon branch** → `42P01` (relation does not exist) when the branch is empty/behind — e.g. Neon `production` before the 10.7 cutover.
- **Missing `SESSION_SECRET`** in prod → hard fail on any `/admin` or `/login` request (fail-fast by design).

## Conventions

### TypeScript
- Strict mode. No `any`.
- Postgres rows are typed by hand at the call site — `query<T>()` / `queryOne<T>()` from `src/lib/db.ts` with an inline row type (DEC-046). No codegen.

### Next.js 16 routing
- `src/proxy.ts` is the middleware entry point — export name is `proxy`, not `middleware`. Do NOT create `src/middleware.ts`; Next.js 16 will reject both existing simultaneously.
- Check `src/` structure before writing new auth/routing files.

### Components
- Server Components by default. `'use client'` only when needed.
- shadcn/ui in `components/ui/` — don't edit directly.
- Feature components in `components/[feature]/`.
- Under 200 lines per component. Split if larger.

### Data Fetching
- Server Components + Server Actions query Postgres via `query`/`queryOne` from `src/lib/db.ts` (the pg pool).
- Mutations via Server Actions (not API routes). Every action gates on `getAdminUser()` (DEC-047) for admin surfaces.
- No client-side DB access — customer reads resolve `bbf_customer_token` → `customers.token` server-side (DEC-004).

### Auth & access
- Admin: self-rolled email→code→HMAC session (DEC-047), verified in `src/proxy.ts` + `getAdminUser()`. No Supabase Auth, no OAuth, no JWT library.
- The **service layer is the access boundary** — no RLS (DEC-048). Admin routes sit behind the session; customer routes behind the token.
- `src/proxy.ts` handles the `/admin` gate + redirects.

### Error Handling
- Form actions: `string | null` (null = success).
- Button actions: `{ error: string | null }`.
- Never `throw` in server actions — return errors for inline feedback.

### Database
- Migrations are source of truth.
- Configurable values in lookup tables, not hardcoded enums.

### Naming
- Files: `kebab-case.tsx`
- Components: `PascalCase`
- Server Actions: `camelCase` in `actions/`
- DB columns: `snake_case`
- Migrations: `db/migrations/NNNN_descriptive_name.sql` (zero-padded sequence)

### UI / Brand
- White/black base, semantic shadcn tokens. No color for color's sake.
- One border radius: `rounded-lg`.
- Layout padding in `layout.tsx` only.
- Customer-side: every page works at 375px (DEC-019).
- **All CSS lives in `src/styles/app.css`.** No per-page CSS files (`inventory.css`, `admin-customers.css`, etc.). No area files (`admin.css`, `customer.css`). When a page needs new styles, extend `app.css` under a clearly-labeled section — that's where the customer-table classes (`.cust-*`) and drawer primitives (`.drawer-*`) sit alongside `.btn` / `.field` / `.data-table`. Per-page CSS duplicates primitives that drift across files; one file with composable primitives is the standard, set in session 15 and re-litigated in session 16. If anyone (you, me, a future contributor) proposes a per-page or area CSS file, push back — the answer is no.

### Testing (DEC-023)
- **Test the user, not the function.** Heavy integration, light unit.
- **Test-first when behavior changes.** Update the test, then the code.
- vitest in `db/tests/` (pg-integration) + `src/**/*.test.ts` (unit); Playwright `*.spec.ts` in `tests/` (DEC-051).
- Viewports: 375px (mobile), 768px (tablet), 1440px (desktop).
- WebKit on every PR for customer-side (mobile-prioritized).
- Full matrix on main / release.
- `NOTIFICATIONS_ENABLED=false` in test env. Mock external services.

## PR / Deploy (project)
The universal PR rules live in the shell's `## PR Workflow`. bushel deploy + preview specifics:

### Production branch (DEC-S022)
`main` is the always-active trunk. Bushel currently deploys straight off `main`:
- `/kill-this` opens PRs into `main` per task.
- `/retro` patch-bumps per merged PR + minor-bumps at phase close, tagging on `main` immediately.

Adopting a `production` deploy branch later (optional — a downstream pointer Vercel watches):
```
git checkout -b production main && git push -u origin production
```
Then repoint Vercel's production branch from `main` to `production` (Settings → Git → Production Branch) **before** `main` takes new work, or WIP auto-deploys to prod. After that, ship with `/promote-production`, which ff-merges `main` → `production` and pushes (the tag is already on the commit from the bump — promotion does not tag). `production` is never a PR base and never read by sync; `/promote-production` gates on `origin/production`, so opting in/out is just the branch existing.

### Mobile PR review (developer notes)
- GitHub mobile app, not web.
- Tap the preview URL first — prefer the stable `preview.baybranchfarm.com` over the per-PR Vercel URL (see below).
- Auto-merge enabled per PR after CI green.
- Branch protection: require CI green; skip reviewer-count requirements for solo phase.

### Stable preview URL — `preview.baybranchfarm.com`

To keep the preview URL bookmarkable on a phone, a fixed subdomain points at whichever task branch's preview deployment you're currently reviewing. Reassigned per active branch.

**DNS (Cloudflare, one-time):**
- Record: `CNAME`, Name `preview`, Target `cname.vercel-dns.com`.
- **Proxy: DNS only** (gray cloud). Orange-cloud proxying breaks Vercel's TLS chain.

**Vercel domain (one-time):**
- Project → Settings → Domains → Add `preview.baybranchfarm.com`.

**Per-branch reassignment (every new task branch):**
- Project → Settings → Domains → `preview.baybranchfarm.com` → **Edit** → Git Branch → select `task/X.Y-current-branch` → Save.
- New preview build for that branch repoints the subdomain. ~30s.

(Admin auth is now the self-rolled email-code session (DEC-047) — no OAuth redirect allowlist to maintain. Preview login just needs `SESSION_SECRET` + `RESEND_*` on the Vercel Preview scope.)

If the subdomain returns 500 or 404 right after reassignment, the new branch hasn't pushed a commit yet — Vercel only builds on new SHAs (404 = no deployment exists for that branch; 500 = deployment exists but is broken, usually a different bug). An empty commit (`git commit --allow-empty -m "Trigger preview"`) kicks a build.

## Versioning (project)
The versioning policy lives in the shell's `## Versioning`. bushel's `<VersionTag />` wiring:

Build-time version display at `src/components/VersionTag.tsx`. Reads `process.env.NEXT_PUBLIC_APP_VERSION` + `process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`. Renders e.g. `v1.2.3 (a1b2c3)`.

- `next.config.ts` forwards `npm_package_version` → `NEXT_PUBLIC_APP_VERSION`. Critical — without `NEXT_PUBLIC_`, client trees silently render `v0.0.0`.
- Currently rendered in the placeholder home page footer at `src/app/page.tsx`. Login screen now exists at `src/app/login/page.tsx`; **moving the tag to the login screen + a global footer is a Phase 6.1 polish task.**
- Vercel sets `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` automatically. Local `npm run dev` outside Vercel omits the commit hash — that's intentional.

## Workflow Notes (project)
Universal workflow notes live in the shell's `## Workflow Notes`. bushel-specific gotchas:

- **Before starting `npm run dev`:** run `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` first. If it returns 200, skip the start — a server is already up. Only start a new one if the check fails.
- **Stale `next start` on port 3001:** Playwright's webServer config reuses an existing server on port 3001 when one is running. A `next start` left over from an earlier debug run will serve the previous build's bundle to every test in the new run, producing phantom failures (asset 404s, "old code" assertions, hydration mismatches) that vanish on a fresh process. Before the first targeted `npx playwright test` invocation in a session — especially after build changes — kill any orphan: `lsof -ti:3001 | xargs -r kill -9` (or `pkill -f "next start"`). Re-check with `lsof -ti:3001` — empty output means the port is clean. Do this once per session, not per test run.
- **Run test commands bare.** Playwright reads `.env.local` via `dotenv` in `playwright.config.ts`, and vitest integration tests default to docker `bushel_test` — neither needs any env prefix. Don't prefix with `source …` or `DATABASE_URL=… &&` unless deliberately retargeting; a leading `source`/`export` falls outside the `Bash(npx *)` allowance and triggers a permission prompt per variation. Just `npx playwright test tests/foo.spec.ts --project=desktop` / `npm run test:unit`.

## Approval Before Action (project)
The shell's `## Approval Before Action` applies. bushel addition:

**Includes the full test suite.** Database may be in use. Targeted runs OK during dev; full suite never automatic.
