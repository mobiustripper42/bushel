# bushel — Claude Code Project Context

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
| `docs/SPEC.md` | What we're building — scope, V1 vs V2 vs V3 |
| `docs/DECISIONS.md` | Architectural decisions (DEC-001…DEC-027) |
| `docs/USER_STORIES.md` | What each role does (TODO: B2B-reframe) |
| `docs/PROJECT_PLAN.md` | Phases, scope, velocity. **Phase-boundary doc** — read at planning, written at retro. Current-phase tasks live in GitHub Issues. |
| `docs/RETROSPECTIVES.md` | Phase-end retrospectives — written by `/retro` |
| `docs/AGENTS.md` | Agent and skill specs |
| `docs/BRAND.md` | Voice, type, color (TODO: fill at start of Phase 0.7) |
| `docs/VELOCITY_AND_POKER_GUIDE.md` | Estimation methodology |
| `docs/CHEATSHEET.md` | One-page printable skill reference |
| `sessions/*.md` | Per-session files — `YYYY-MM-DD-HHMM-<dev>-<slug>.md` |
| `.claude/seeds-version` | Schema version this project was last installed at. Used by `/pull-seeds` to gate template syncs. |
| `.claude/project-type` | Project type — `webapp` or `tool`. Used by `@sync-config` to gate template files that don't apply to this project's type (DEC-011). Optional. |

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
8. **Open PR** — `/kill-this` commits, pushes, opens PR with `closes #<issue>`. Preview URL lands in description.
9. **Review & ship** — tap preview URL, address `@code-review` findings, run full suite if RLS-touching, merge.

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

### Supabase CLI auth (mill-dev)

The global `supabase login` on mill-dev is the **sailbook** account. Bushel lives in a different Supabase account, so any bushel CLI command that talks to the cloud project must override with `SUPABASE_ACCESS_TOKEN` (a Personal Access Token generated in the bushel account's profile):

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx supabase link --project-ref nnmfubmlvnkouxxfxxlh
SUPABASE_ACCESS_TOKEN=sbp_xxx supabase db push
```

If direnv is wired (`.envrc` exports the token, gitignored), the var is set automatically when you `cd ~/bushel/`. Without the override, you'll get `Your account does not have the necessary privileges` — that's the symptom. Local-only commands (`supabase start`, `supabase test db`, `supabase migration new`) don't need the token.

Why two accounts: bushel is billed separately from sailbook so LTSC can take sailbook later without untangling shared accounts.

### Production write protection (DEC-009)

Two-layer defense against accidentally running destructive Supabase CLI ops on production:

1. **Discipline:** never `supabase link` to a prod project ref from a dev box. Production deploys read `SUPABASE_URL` and the service-role key from Vercel env vars — there is no reason for a local link to prod. Link only to staging or local.
2. **Wrapper script (`scripts/safe-supabase.sh`):** reads the linked ref from `supabase/.temp/project-ref` and refuses to pass through `db reset`, `db push`, `db remote *`, `migration up`, or `migration repair` if the linked ref appears in `.claude/prod-supabase-refs`. Pass-through for everything else. The matcher walks adjacent argument pairs, so leading global flags (`--debug`, `--workdir`, etc.) don't bypass the guard.

Setup (one-time):

```
chmod +x scripts/safe-supabase.sh
mkdir -p .claude
echo "<your-prod-project-ref>" > .claude/prod-supabase-refs
echo ".claude/prod-supabase-refs" >> .gitignore
```

Optional shell alias for transparent protection:

```
alias supabase='./scripts/safe-supabase.sh'
```

The `.claude/prod-supabase-refs` file accepts one ref per line; blank lines and `#` comments are ignored. Per-project rather than global so multi-project dev boxes don't cross-contaminate.

The wrapper only catches CLI ops. The following are **not** guarded — they rely on the discipline:
- `--db-url postgres://...prod...` flags on `db push` / `db remote commit` skip the linked-project entirely.
- Direct `psql` against the prod URL.
- Any tool that doesn't go through the `supabase` binary.

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
| `/its-alive` | Session start | Open per-session file, capture transcript path, read context, recommend task |
| `/pause-this` | Mid-session break | Build check, commit WIP, note pause |
| `/restart-this` | Resume from pause | Reload context, continue same session |
| `/kill-this` | Session end (part 1) | Build check, commit, push branch, open PR, code review, draft body |
| `/its-dead` | Session end (part 2) | Calc duration + points, finalize session file, branch cleanup, patch-bump on merged PR |
| `/start-phase` | Phase boundary (start) | Materialize phase as Issues with `phase:N`, `points:X` labels |
| `/retro` | Phase boundary (end) | Close phase, reconcile drift, compute velocity, write retro, minor-bump |
| `/bump-major` | Breaking change | Manually bump major version. CHANGELOG.md entry + tag (on main) or deferred tag (on staging). Dev projects only |
| `/promote-staging` | Ship staging to prod | ff-merge `staging` → `main`, tag the release with current `package.json` version, push both. Staging-flow projects only |
| `/push-seeds` | After workflow improvements | Backport project-side improvements to the seeds templates via @sync-config |
| `/pull-seeds` | After seeds gets new improvements | Pull template changes into this project — schema-version-gated, applied via @sync-config |
| `/read-the-tape` | After a session worth learning from | Audit JSONL transcript, find anti-patterns, propose skill improvements |

**Dev identity:** `~/.claude/devname` (one-line file with handle, e.g. `eric`). Set once per machine.

## Agents

| Agent | Model | When | Purpose |
|-------|-------|------|---------|
| @architect | Opus | Before design decisions, new dependencies, scope creep | Coherence vs SPEC + DECISIONS |
| @code-review | Sonnet | After every commit (wired into `/kill-this`) | Catch issues early |
| @pm | Sonnet | Start/end of sessions via skills | Track progress, flag risks |
| @ui-reviewer | Sonnet | After UI work, phase boundaries | Design quality |

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

### Staging vs no-staging (DEC-008)

Bushel currently has no `origin/staging`, so it ships PRs straight to `main`:
- `/kill-this` opens PRs into `main`.
- `/its-dead` patch-bumps on `main` and tags `vX.Y.Z` immediately.
- `/retro` minor-bumps on `main` and tags `vX.0.0` immediately.

Adopting staging later: cut from `main` once and skills auto-detect.
```
git checkout -b staging main && git push -u origin staging
```
After that, `/kill-this` PRs into `staging`, bumps are untagged on `staging`, and `/promote-staging` ff-merges `staging` → `main` and tags the release. No skill changes required to opt in or out — staging existence (`git show-ref --verify --quiet refs/remotes/origin/staging`) is the only signal.

### Mobile PR review (developer notes)
- GitHub mobile app, not web.
- Tap the preview URL first.
- Auto-merge enabled per PR after CI green.
- Branch protection: require CI green; skip reviewer-count requirements for solo phase.

## Versioning (DEC-007)

Bushel carries a SemVer version in `package.json`, mirrored to a git tag (`vX.Y.Z`) on `main`. Currently `0.1.0` — first release path. `/its-dead` patch-bumps from there.

**Three triggers:**
- **Patch:** `/its-dead` after every PR merge. CHANGELOG entry derived from PR title.
- **Minor:** `/retro` at phase close. CHANGELOG entry summarizes the phase.
- **Major:** `/bump-major` manual. User supplies the breaking-change rationale.

**Tag rule:** tags only ever applied on `main`. In staging-flow projects (which bushel currently isn't — see above), bumps on `staging` are untagged; the tag lands when `/promote-staging` ff-merges.

### `<VersionTag />` component

Build-time version display at `src/components/VersionTag.tsx`. Reads `process.env.NEXT_PUBLIC_APP_VERSION` + `process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`. Renders e.g. `v1.2.3 (a1b2c3)`.

Wiring:
- `next.config.ts` forwards `npm_package_version` → `NEXT_PUBLIC_APP_VERSION`. Critical — without `NEXT_PUBLIC_`, client trees silently render `v0.0.0`.
- Currently rendered in the placeholder home page footer at `src/app/page.tsx`. **Move to login screen + global footer when those land.** Per `dev/claude/CLAUDE.md §Versioning` in seeds.
- Vercel sets `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` automatically. Local `npm run dev` outside Vercel omits the commit hash — that's intentional.

```tsx
import { VersionTag } from "@/components/VersionTag";
<VersionTag className="text-xs text-muted-foreground" />
```

### CHANGELOG.md

Auto-maintained by `/its-dead`, `/retro`, and `/bump-major`. Don't edit by hand mid-flow — the skills always prepend after the `# Changelog` header. The first bump creates the file if absent.

## Workflow Notes
- **Diagnostic commands** (build, lint, type, test): run directly.
- **Environment-changing commands** (npm install, migrations, push, deploys): output for user to run.
- **Never rebase a task branch with commits on origin.** Use GitHub's "Update branch" at merge time.
- **Debugging CI failures:** Before any multi-step local debug (spawning servers, reading cookies, modifying middleware), confirm the environment is functional: "Can you run `npx playwright test` locally right now? What env vars are set?" One environmental check before any code change.
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
