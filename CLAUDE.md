# bushel — Claude Code Project Context

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

## Key Docs

| File | Purpose |
|------|---------|
| `docs/SPEC.md` | What we're building — scope, V1 vs V1.5 vs V2 |
| `docs/DECISIONS.md` | Architectural decisions (DEC-001…DEC-032) |
| `docs/SCHEMA.md` | Finalized table shapes; gates migrations + RLS |
| `docs/USER_STORIES.md` | What each role does (B2B-reframed; pending review) |
| `docs/PROJECT_PLAN.md` | Phases, scope, velocity. **Phase-boundary doc** — read at planning, written at retro. Current-phase tasks live in GitHub Issues. |
| `docs/RETROSPECTIVES.md` | Phase-end retrospectives — written by `/retro` |
| `docs/AGENTS.md` | Agent and skill specs (canonical). The repo-root `AGENTS.md` is a Next.js-agent rules stub for IDE tooling — not the project agent doc. |
| `docs/BRAND.md` | Voice, type, color |
| `docs/VELOCITY_AND_POKER_GUIDE.md` | Estimation methodology |
| `docs/CHEATSHEET.md` | One-page printable skill reference |
| `sessions/*.md` (on orphan `sessions` branch via `.sessions-worktree/`) | Per-session files — `YYYY-MM-DD-HHMM-<dev>-<slug>.md`. Atomic after `/its-dead` closes (DEC-013); orphan branch decouples session log from any code branch (DEC-014). |
| `.claude/seeds-version` | Schema version this project was last installed at. Used by `/pull-seeds` to gate template syncs. |
| `.claude/project-type` | Project type — `webapp` or `tool`. Used by `@sync-config` to gate template files that don't apply to this project's type. Optional. |

## Core Data Model (target — see Phase 1.1)

```
products → order_items
customers (token, contact, send_weekly_link) → orders → order_items
orders.needs_reconciliation (oversold flag)
orders.pickup_note, orders.delivery_preference (DEC-029: free-text fulfillment, no structured pickup windows in V1)
ordering_schedule (is_open default true per DEC-030)
```

Schema details land in Phase 1.1 (sketched in plan; finalize at execution).

## Micro Workflow (every task, no exceptions)

1. **Spec it** — poker estimate, acceptance criteria. Issue exists from `/start-phase`.
2. **Plan it** — summarize what you're going to do. Wait for explicit approval before writing code or running commands.
3. **Cut the branch** — once approved: `git checkout -b task/X.Y-short-description`.
4. **Build it**
5. **Write the test** — Playwright integration test + pgTAP if RLS-touching. Test-first when behavior is changing (DEC-023).
6. **Run targeted tests** — `npx playwright test tests/foo.spec.ts --project=desktop` (and mobile/webkit for customer-side). `supabase test db` if RLS-touching. Do NOT run full suite — that's the user's call.
7. **Mobile screenshot** — confirm 375px viewport passes for customer-side
8. **Ship the task** — `/kill-this` commits, pushes, opens PR with `closes #<issue>`, appends a `## Task <N>` block to the session file (on the orphan `sessions` branch). Run per task; multiple per session.
9. **Pick up another task or close out** — start step 1 with a new branch, or run `/its-dead` once at the end of the Claude window. Merge PRs whenever — order doesn't matter (DEC-013).

**No test, no push.**

**Full suite (`npx playwright test`) is never run automatically.** Ask first.

## Migration Protocol

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
|------|------------|---------|
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

## Session Skills

| Skill | When | What |
|-------|------|------|
| `/its-alive` | Session start | Ensure `.sessions-worktree/` exists, open per-session file on orphan `sessions` branch, capture transcript, read context, recommend task |
| `/pause-this` | Mid-session break | Build check, commit WIP on task branch, note pause in session file (sessions branch) |
| `/restart-this` | Resume from pause | Reload context, continue same session |
| `/kill-this` | **Per task** (DEC-013) | Build check, commit code on task branch, open PR, append `## Task <N>` block to session file. Run N times per session — one per task. No time math. |
| `/its-dead` | Session end (once per window) | Stamp `ended:`, tally points, display wall_clock to screen, close session file. No time math, no version bump (those moved to `/retro`). Merge PRs whenever. |
| `/start-phase` | Phase boundary (start) | Materialize phase as Issues with `phase:N`, `points:X` labels |
| `/retro` | Phase boundary (end) | Compute per-session wall/dev/review from `started`/`ended`/transcript/PR timestamps. Aggregate phase velocity. Mark `[x]`, write retro, patch-bump per merged PR + minor-bump at close. |
| `/bump-major` | Breaking change | Manually bump major version. CHANGELOG.md entry + tag (on main) or deferred tag (on staging). Dev projects only |
| `/promote-staging` | Ship staging to prod | ff-merge `staging` → `main`, tag the release with current `package.json` version, push both. Staging-flow projects only |
| `/push-seeds` | After workflow improvements | Backport project-side improvements to the seeds templates via @sync-config |
| `/pull-seeds` | After seeds gets new improvements | Pull template changes into this project — schema-version-gated, applied via @sync-config |
| `/read-the-tape` | After a session worth learning from | Audit JSONL transcript, find anti-patterns, propose skill improvements |
| `/doc-consistency-check` | Mid-project, before phase boundaries, or after a session that touched multiple docs | Cross-reference factual claims across `docs/*.md` + root `CLAUDE.md`; flag mismatches + unfilled placeholders. Report-only via @doc-consistency |

**Dev identity:** `~/.claude/devname` (one-line file with handle, e.g. `eric`). Set once per machine.

## Agents

| Agent | Model | When | Purpose |
|-------|-------|------|---------|
| @architect | Opus | Before design decisions, new dependencies, scope creep | Coherence vs SPEC + DECISIONS |
| @code-review | Sonnet | After every commit (wired into `/kill-this`) | Catch issues early |
| @pm | Sonnet | Start/end of sessions via skills | Track progress, flag risks |
| @ui-reviewer | Sonnet | After UI work, phase boundaries | Design quality |
| @sync-config | Sonnet | `/push-seeds` and `/pull-seeds` | Classifies template-vs-project diffs, gates structural backports |
| @tape-reader | Sonnet | `/read-the-tape` | Audits session JSONL for workflow anti-patterns |
| @doc-consistency | Sonnet | Via `/doc-consistency-check` skill, or ad-hoc | Cross-reference factual claims across project docs; flag mismatches + unfilled placeholders. Report-only |

## Model Selection

- Main session: Sonnet by default. Switch to Opus when stuck.
- Agents: model in agent frontmatter. Don't override unless task warrants.

## PR Workflow

- Each task gets a branch: `git checkout -b task/X.Y-short-description`.
- Issues assigned to phase via `phase:N` label (created by `/start-phase`).
- PR title references issue: `closes #N`.
- `/kill-this` opens PR. Self-merge after review unless stakeholder review needed.
- Keep ≤3 open PRs. Prefer 1.
- Never two open PRs with migrations on the same table — merge one first.
- **Stacking PRs is preferred** when tasks depend on each other. Branch the next task off the previous task branch (`git checkout -b task/X.Y-next task/X.Y-prev`), not off main. Only wait for the previous PR to merge when there's a migration conflict on the same table.

### Staging vs no-staging

Bushel currently has no `origin/staging`, so it ships PRs straight to `main`:
- `/kill-this` opens PRs into `main` per task.
- `/retro` patch-bumps + tags on `main` at phase boundary (no per-PR bump from `/its-dead` post-DEC-013).
- `/retro` minor-bumps on `main` and tags `vX.0.0` immediately.

Adopting staging later: cut from `main` once and skills auto-detect.
```
git checkout -b staging main && git push -u origin staging
```
After that, `/kill-this` PRs into `staging`, bumps are untagged on `staging`, and `/promote-staging` ff-merges `staging` → `main` and tags the release. No skill changes required to opt in or out — staging existence (`git show-ref --verify --quiet refs/remotes/origin/staging`) is the only signal.

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

## Versioning

Bushel carries a SemVer version in `package.json`, mirrored to a git tag (`vX.Y.Z`) on `main`. `/retro` is now the sole place version bumps happen (DEC-013 moved patch bumps out of `/its-dead`).

**Three triggers (all run at `/retro` per DEC-013):**
- **Patch:** `/retro` Step 8.2 — one bump + CHANGELOG entry per PR merged in the phase window. Title pulled from GitHub.
- **Minor:** `/retro` Step 8.3 — at phase close after all patches. CHANGELOG entry summarizes the phase.
- **Major:** `/bump-major` manual. User supplies the breaking-change rationale.

**Tag rule:** tags only ever applied on `main`. In staging-flow projects (which bushel currently isn't — see above), bumps on `staging` are untagged; the tag lands when `/promote-staging` ff-merges.

### `<VersionTag />` component

Build-time version display at `src/components/VersionTag.tsx`. Reads `process.env.NEXT_PUBLIC_APP_VERSION` + `process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`. Renders e.g. `v1.2.3 (a1b2c3)`.

Wiring:
- `next.config.ts` forwards `npm_package_version` → `NEXT_PUBLIC_APP_VERSION`. Critical — without `NEXT_PUBLIC_`, client trees silently render `v0.0.0`.
- Currently rendered in the placeholder home page footer at `src/app/page.tsx`. Login screen now exists at `src/app/login/page.tsx`; **moving the tag to the login screen + a global footer is a Phase 6.1 polish task.**
- Vercel sets `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` automatically. Local `npm run dev` outside Vercel omits the commit hash — that's intentional.

```tsx
import { VersionTag } from "@/components/VersionTag";
<VersionTag className="text-xs text-muted-foreground" />
```

### CHANGELOG.md

Auto-maintained by `/retro` and `/bump-major` (DEC-013 — `/its-dead` no longer touches it). Don't edit by hand mid-flow — the skills always prepend after the `# Changelog` header. The first bump creates the file if absent.

## Workflow Notes
- **Diagnostic commands** (build, lint, type, test): run directly.
- **Environment-changing commands** (npm install, migrations, push, deploys): output for user to run.
- **Never rebase a task branch with commits on origin.** Use GitHub's "Update branch" at merge time.
- **Debugging CI failures:** Before any multi-step local debug (spawning servers, reading cookies, modifying middleware), confirm the environment is functional: "Can you run `npx playwright test` locally right now? What env vars are set?" One environmental check before any code change.
- **Stale `next start` on port 3001:** Playwright's webServer config reuses an existing server on port 3001 when one is running. A `next start` left over from an earlier debug run will serve the previous build's bundle to every test in the new run, producing phantom failures (asset 404s, "old code" assertions, hydration mismatches) that vanish on a fresh process. Before the first targeted `npx playwright test` invocation in a session — especially after build changes — kill any orphan: `lsof -ti:3001 | xargs -r kill -9` (or `pkill -f "next start"`). Re-check with `lsof -ti:3001` — empty output means the port is clean. Do this once per session, not per test run.
- **No `source .envrc` for `npx playwright test`:** Playwright reads `.env.local` via `dotenv` in `playwright.config.ts` — it does not need `.envrc`. The `source .envrc &&` prefix is for `supabase link` / `supabase db push` only (lines above), because those need `SUPABASE_ACCESS_TOKEN`. Prefixing test commands with `source .envrc &&` triggers a permission prompt per invocation (the leading `source` falls outside `Bash(npx *)`), and each variation — different spec, project, or pipe target — is a new prompt. Run tests bare: `npx playwright test tests/foo.spec.ts --project=desktop`.
- **JSON parsing in Bash:** Prefer `gh ... --jq '...'` (built-in jq via `gh`) or `jq` over `python3 -c "import json,sys; ..."` one-liners. The python invocations trigger per-pattern permission prompts (each unique argument list is a new allowlist entry), while `gh --jq` runs under the existing `Bash(gh ...)` allowance. For non-`gh` JSON, install/use `jq` directly. Reserve python for cases where the data shape genuinely needs control flow.
- **Bug reports:** create a GitHub issue, label `bug`, add to current or next phase.

## Approval Before Action (all tasks)
For every task — explain the plan, wait for "go" or equivalent.
1. State files you'll create/modify and why
2. Wait for approval
3. No code, files, or commands until approved

**Includes the full test suite.** Database may be in use. Targeted runs OK during dev; full suite never automatic.

## Bug Reports & Questions
1. Explain cause + proposed fix
2. Wait for approval
3. No edits until go-ahead

## Scope Discipline
Check `docs/SPEC.md` "Not V1" before adding anything.

If a task feels bigger than its estimate:
1. Stop, re-estimate
2. Update PROJECT_PLAN.md (at next phase boundary, or via Issue if mid-phase)
3. If now a 13, break it down
4. If scope creep, flag and move on

## Tone
Occasional dry humor and sarcasm welcome. One good line beats three forced ones.

## Verbosity

End-of-turn summaries: one or two sentences. What changed, what's next. Stop there.

Do not recap work I just watched you do. Do not restate the task. Do not explain why an obvious step was obvious. The summary exists so I can re-enter context next session — not so you can demonstrate effort.

If a turn ends with a tidy bullet list followed by three paragraphs of prose, the prose is wrong. Delete it.

Mid-session updates: one sentence per state change. "Found X." "Switching to Y." "Build green." Not a paragraph.

This rule applies double at session end. The session-summary block is the first thing I read next session — make it dense, not voluminous. Five bullets of work and a wall of text means I cannot actually use the summary. Cut the wall.

## Cost and Waste

Never minimize cost. Banned phrasings include but are not limited to:
- "essentially zero"
- "negligible"
- "only a few cents"
- "just X dollars"
- "a rounding error"
- "not a big deal"
- "don't worry about it"

If you find yourself reaching for one, stop. Any synonym counts. If the function of the phrase is to minimize, it's banned.

It's my money. Willing-to-spend is not the same as willing-to-spend-flippantly. Treat every cost as real, including small ones. Same rule for compute, API calls, third-party services, and dependencies — anything that consumes resources I'm paying for.

Waste of any kind — food thrown out, hours lost, a bad batch, a bricked migration, an over-provisioned instance, a wrong dependency pulled — is a fact, not a problem to console me about. When I tell you something had to be discarded, do not reassure me it's fine. Acknowledge it and move on.

If you catch yourself about to write a reassurance, just don't. The fact is the fact.
