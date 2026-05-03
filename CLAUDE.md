# bushel — Claude Code Project Context

## What We're Building

Bay Branch Farm Inventory & Order System (`order.baybranchfarm.com`). Replaces tend.com for ~7 B2B customers (2 farm stands, 1 grocery store, 3–4 restaurants) on a weekly Sun/Mon → Wed/Thu cadence.

Roles:
- **Admin** — Annabel. Manages inventory, customers, orders, send notifications.
- **Customer (B2B)** — receives weekly SMS link, places order through tokenized URL.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript strict, sailbook-style CSS (DEC-021)
- **Backend:** Supabase (PostgreSQL + Auth + RLS) — no separate API server
- **Notifications:** Twilio (toll-free SMS). Resend dropped (DEC-020).
- **Hosting:** Vercel (frontend), Supabase Cloud (database)
- **Testing:** pgTAP (RLS), Playwright (integration, mobile/tablet/desktop), axe-core (a11y)
- **Domain:** `order.baybranchfarm.com` (CNAME → Vercel); apex stays Astro/Netlify

## Key Docs

| File | Purpose |
|------|---------|
| `docs/SPEC.md` | What we're building — scope, V1 vs V2 vs V3 |
| `docs/DECISIONS.md` | Architectural decisions (DEC-001…DEC-024) |
| `docs/USER_STORIES.md` | What each role does (TODO: B2B-reframe) |
| `docs/PROJECT_PLAN.md` | Phases, scope, velocity. **Phase-boundary doc** — read at planning, written at retro. Current-phase tasks live in GitHub Issues. |
| `docs/RETROSPECTIVES.md` | Phase-end retrospectives — written by `/retro` |
| `docs/AGENTS.md` | Agent and skill specs |
| `docs/BRAND.md` | Voice, type, color (TODO: fill at start of Phase 0.7) |
| `docs/VELOCITY_AND_POKER_GUIDE.md` | Estimation methodology |
| `sessions/*.md` | Per-session files — `YYYY-MM-DD-HHMM-<dev>-<slug>.md` |

## Core Data Model (target — see Phase 1.1)

```
products → order_items
customers (token, contact, notification_preference) → orders → order_items
orders.needs_reconciliation (oversold flag)
pickup_windows, ordering_schedule
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
| `/its-dead` | Session end (part 2) | Calc duration + points, finalize session file, branch cleanup |
| `/start-phase` | Phase boundary (start) | Materialize phase as Issues with `phase:N`, `points:X` labels |
| `/retro` | Phase boundary (end) | Close phase, reconcile drift, compute velocity, write retro |

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

### Mobile PR review (developer notes)
- GitHub mobile app, not web.
- Tap the preview URL first.
- Auto-merge enabled per PR after CI green.
- Branch protection: require CI green; skip reviewer-count requirements for solo phase.

## Workflow Notes
- **Diagnostic commands** (build, lint, type, test): run directly.
- **Environment-changing commands** (npm install, migrations, push, deploys): output for user to run.
- **Never rebase a task branch with commits on origin.** Use GitHub's "Update branch" at merge time.
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
