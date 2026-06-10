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
- **Backend:** Supabase (PostgreSQL + Auth + RLS) — no separate API server
- **Notifications:** Operator-sent customer SMS via native `sms:` deep links — no third-party SMS provider (DEC-026). Admin order-arrival alert via transactional email (DEC-027); PWA push as stretch upgrade.
- **Hosting:** Vercel (frontend), Supabase Cloud (database)
- **Testing:** pgTAP (RLS), Playwright (integration, mobile/tablet/desktop), axe-core (a11y)
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

# Database (local Supabase)
supabase start
supabase stop
supabase db reset
supabase migration new <name>
supabase db push

# Testing
supabase test db                                # pgTAP RLS
npx playwright test                             # full suite (workers=1 by config — do not override)
npx playwright test tests/foo.spec.ts --project=desktop  # targeted, dev mode
npx playwright test --ui                        # browser UI

# Types
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

## Additional Docs
Project-specific docs beyond the baseline `## Key Docs` table in the shell:

| File | Purpose |
|------|-------|
| `docs/SPEC.md` | Scope is V1 vs **V1.5** vs V2 (bushel-specific phasing) |
| `docs/SCHEMA.md` | Finalized table shapes; gates migrations + RLS |
| `docs/DECISIONS.md` | bushel decisions run DEC-001…DEC-032 (project-own; distinct from seeds' DEC-S### refs) |
| `docs/USER_STORIES.md` | B2B-reframed; pending review |
| `docs/AGENTS.md` | The repo-root `AGENTS.md` is a Next.js-agent rules stub for IDE tooling — **not** the project agent doc; `docs/AGENTS.md` is canonical |
| `docs/BRAND.md` | Voice, type, color |

## Workflow Overrides
Overrides to the shell's `## Micro Workflow` (customer-side is mobile-prioritized):
- **Step 5/6 testing** — Playwright + pgTAP if RLS-touching (DEC-023); also run mobile/webkit projects for customer-side changes, not just desktop.
- **Step 7 mobile screenshot** — confirm 375px specifically for the customer-side.

## Migration Protocol (project)
The migration **discipline** lives in the shell's `## Migration Protocol`. bushel's toolchain:

**All schema changes go through `supabase/migrations/`.** No exceptions.

- `supabase migration new <name>` to create
- `supabase db reset` to test locally (replays + seed)
- `supabase db push` to apply to remote
- Never edit through the dashboard
- After schema changes: `npx supabase gen types typescript --local > src/lib/supabase/types.ts`
- Before creating: `gh pr list` to check overlapping migrations; merge in-flight first or rename to later timestamp.

### Two Supabase projects (dev/preview + prod)

Bushel runs against **two Supabase projects** under the bushel-billed org:

| Role | Project ref | Used by |
|------|------------|-------|
| dev/preview | `nnmfubmlvnkouxxfxxlh` | `.env.local`, Vercel Development + Preview environments, local Playwright runs |
| production | `piaobrnrmoxnfrpnpixw` | Vercel Production environment only — `order.baybranchfarm.com` |

**Why split:** Annabel uses production daily for real customers/inventory. Dev work — migrations, schema changes, fixture data — happens against the dev/preview project so a botched migration or a `db reset` can't take prod with it.

**Migration discipline (with the split)** — all `supabase link`/`db push` commands need the bushel PAT, so make sure `.envrc` is loaded (direnv or `source .envrc`):

1. `supabase link --project-ref nnmfubmlvnkouxxfxxlh` is the default state. Stay linked here.
2. Write migration → `supabase db reset` against local for a syntax sanity check → `supabase db push` against dev/preview → vet against the running dev/preview app.
3. When dev/preview is happy and the PR has merged, push to prod:
   ```bash
   supabase link --project-ref piaobrnrmoxnfrpnpixw
   supabase db push
   supabase link --project-ref nnmfubmlvnkouxxfxxlh   # relink back, always
   ```
4. The relink-back step is non-negotiable. A forgotten link-to-prod is how `supabase db reset` becomes a resume-update event.

**Local Supabase is NOT the development backend.** `.env.local` and `npm run dev` point at the dev/preview cloud project, not `127.0.0.1:54421`. The reason is Google OAuth — registering `http://localhost:54421` as a redirect on the Google Cloud OAuth client is enough friction (and enough mental-mode-switching for the admin side that uses OAuth) that it's not worth the speed of a purely-local loop. Local Supabase is still used for:

- `supabase db reset` — applies all migrations on a clean local DB to catch syntax errors before pushing to dev/preview.
- `supabase test db` — pgTAP tests, no auth needed, fast.
- Playwright integration tests (CI + `/kill-this`) — env-overridden to local Supabase via the test commands, isolated per run, no cloud round-trip.

`.env.local` keeps the commented-out local URLs at the bottom — handy if this decision is ever reversed, but the default state is cloud.

**Auth config is per-project** — Google OAuth, redirect URLs, providers all live on each project independently. Changes (new OAuth client, new redirect URL, provider toggle) must be applied to both. The dev project's "this works" doesn't carry to prod automatically.

There is no active guard against destructive ops on prod — the defense is the discipline above: link to dev by default, link to prod only for the seconds it takes to push, relink to dev.

### Supabase CLI auth (mill-dev)

**TL;DR — anytime you need to push migrations or hit remote Supabase, run:**

```bash
source .envrc && supabase db push
```

(Or `direnv allow` once to make `.envrc` auto-load on every `cd ~/bushel/`.)

**Why:** the global `supabase login` on mill-dev is the **sailbook** account. Bushel lives in a different Supabase account, so any bushel CLI command that talks to the cloud project must use `SUPABASE_ACCESS_TOKEN` (a Personal Access Token generated in the bushel account's profile, kept in `.envrc` — gitignored).

Without the token: `Your account does not have the necessary privileges` — that's the symptom. Local-only commands (`supabase start`, `supabase test db`, `supabase migration new`) don't need it.

Why two accounts: bushel is billed separately from sailbook so LTSC can take sailbook later without untangling shared accounts.

### Cross-system env-var sync (Supabase ↔ Vercel)

**Vercel env vars and Supabase project refs do not auto-sync.** Bushel runs two Supabase projects (see above); Vercel Production points at the prod project, Vercel Preview/Development + `.env.local` point at dev/preview. The three vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) appear **twice** in Vercel — once per environment scope — with intentionally different values.

When you rotate keys, switch project refs, or otherwise touch these vars, both scopes must stay coherent:
- Vercel **Production** → matches prod project's URL + keys.
- Vercel **Preview + Development** → matches dev/preview project's URL + keys, which is what `.env.local` has.

Vercel does not redeploy on env-var change. After updating, trigger a redeploy of `main` (Deployments → ⋯ → Redeploy) or push any commit.

Failure modes:
- **Undefined values:** `createServerClient()` gets `undefined` for URL or key → `HTTP 500` site-wide. Local `npm run dev` keeps working because it reads `.env.local` directly, masking the regression until someone hits the deployed site. Session 19 (2026-05-14) lost an hour to this during the bushel/sailbook account split.
- **Swapped projects:** Prod points at the dev DB or vice versa. Symptoms: prod login works but shows test fixtures, or Annabel's real data appears on a preview URL. Diff-check before assuming everything is wired correctly.
- **Name typo:** A Vercel-side name like `SUPABASE_ANON_KEY` instead of `NEXT_PUBLIC_SUPABASE_ANON_KEY` produces the same 500 even when the value is correct.

Diff-check ritual after any rotation:

```bash
vercel env pull --environment=production .env.production.tmp
vercel env pull --environment=preview    .env.preview.tmp
# Preview should match .env.local:
diff <(grep -E "SUPABASE" .env.local            | sort) \
     <(grep -E "SUPABASE" .env.preview.tmp      | sort)
# Production should NOT match .env.local — it should reference the prod project ref:
grep "SUPABASE_URL" .env.production.tmp   # expect piaobrnrmoxnfrpnpixw.supabase.co
```

## Conventions

### TypeScript
- Strict mode. No `any`.
- Generated Supabase types from `lib/supabase/types.ts`. Regenerate after every schema change.

### Next.js 16 routing
- `src/proxy.ts` is the middleware entry point — export name is `proxy`, not `middleware`. Do NOT create `src/middleware.ts`; Next.js 16 will reject both existing simultaneously.
- Check `src/` structure before writing new auth/routing files.

### Components
- Server Components by default. `'use client'` only when needed.
- shadcn/ui in `components/ui/` — don't edit directly.
- Feature components in `components/[feature]/`.
- Under 200 lines per component. Split if larger.

### Data Fetching
- Server Components fetch via Supabase server client.
- Mutations via Server Actions (not API routes).
- Real-time / post-interaction client data uses Supabase browser client.

### Auth & RLS
- All auth through Supabase. No custom JWT.
- Role flags on users table; not mutually exclusive.
- Every table needs RLS policies before shipping. Every RLS change needs a pgTAP test.
- Middleware handles role-based redirects.

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
- Migrations: `supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql`

### UI / Brand
- White/black base, semantic shadcn tokens. No color for color's sake.
- One border radius: `rounded-lg`.
- Layout padding in `layout.tsx` only.
- Customer-side: every page works at 375px (DEC-019).
- **All CSS lives in `src/styles/app.css`.** No per-page CSS files (`inventory.css`, `admin-customers.css`, etc.). No area files (`admin.css`, `customer.css`). When a page needs new styles, extend `app.css` under a clearly-labeled section — that's where the customer-table classes (`.cust-*`) and drawer primitives (`.drawer-*`) sit alongside `.btn` / `.field` / `.data-table`. Per-page CSS duplicates primitives that drift across files; one file with composable primitives is the standard, set in session 15 and re-litigated in session 16. If anyone (you, me, a future contributor) proposes a per-page or area CSS file, push back — the answer is no.

### Testing (DEC-023)
- **Test the user, not the function.** Heavy integration, light unit.
- **Test-first when behavior changes.** Update the test, then the code.
- pgTAP in `supabase/tests/`, Playwright in `tests/`.
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

**Supabase OAuth allowlist (one-time):**
- Supabase Dashboard → Authentication → URL Configuration → Redirect URLs → add `https://preview.baybranchfarm.com/**`.
- **Double-star, not single-star.** `/*` matches one path segment only (so `/auth/callback` fails to match); `/**` matches any path. A single-star slip costs an hour of "auth almost works" debugging — Supabase silently falls back to Site URL on a non-match, and the user lands on `/?code=...` with the callback route never running. Session 19 (2026-05-14) burned this exact hour.

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
- **No `source .envrc` for `npx playwright test`:** Playwright reads `.env.local` via `dotenv` in `playwright.config.ts` — it does not need `.envrc`. The `source .envrc &&` prefix is for `supabase link` / `supabase db push` only (lines above), because those need `SUPABASE_ACCESS_TOKEN`. Prefixing test commands with `source .envrc &&` triggers a permission prompt per invocation (the leading `source` falls outside `Bash(npx *)`), and each variation — different spec, project, or pipe target — is a new prompt. Run tests bare: `npx playwright test tests/foo.spec.ts --project=desktop`.

## Approval Before Action (project)
The shell's `## Approval Before Action` applies. bushel addition:

**Includes the full test suite.** Database may be in use. Targeted runs OK during dev; full suite never automatic.
