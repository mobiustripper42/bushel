---
session: 2
dev: eric
slug: pull-seeds-and-0.3
branch: main
started: 2026-05-06T11:23:44Z
ended: 2026-05-06T17:12:42Z
duration: 5.83
points: 3
status: closed
transcript: /home/eric/.claude/projects/-home-eric-bushel/a7be0726-119e-4648-8d3d-9c0705637216.jsonl
---

# Session 2 — pull-seeds-and-0.3

**Task:** Phase 0.3 — Supabase scaffold, Google OAuth, customers table, dev port/host pinning (closes #4)

**Completed:**
- Renamed dev host to mill-dev (hostnamectl + Tailscale + SSH config dual-alias)
- Pinned dev server to :3001 (-H 0.0.0.0); DEC-025 written (Tailscale-only access, admin OAuth carve-out on localhost:3001 via SSH LocalForward)
- Supabase local stack initialized; ports bumped +100 (54421–54429) to coexist with sailbook on same box
- `supabase/migrations/20260506130248_customers_initial.sql`: customers table + RLS (authenticated-only); 10/10 pgTAP green
- `@supabase/ssr` + `@supabase/supabase-js` installed; `src/lib/supabase/{client,server,middleware,types}.ts`
- `src/proxy.ts`: Next.js 16 session refresh (renamed from deprecated `middleware.ts`)
- `/login` page + `signInWithGoogle` server action + `/auth/callback` route handler
- Google OAuth configured in Supabase dashboard; cloud Supabase project created under separate bushel account
- `CLAUDE.md`: Supabase CLI auth pattern (SUPABASE_ACCESS_TOKEN for remote bushel commands; sailbook uses global login)
- `.env.example` committed; `.gitignore` updated (`.envrc` gitignored)
- PR #10 opened + merged; OAuth round-trip tested and working (localhost:3001 → Google → callback → authenticated)

**In Progress:** none

**Blocked:** none

**Next Steps:**
1. Address PR #10 code review findings (open redirect in `/auth/callback`, empty origin fallback in `login/actions.ts`, silent auth errors on `/login`) — fold into next task or fix standalone
2. Next task: #5 Phase 0.5 (3 pts) — Playwright scaffold (3-device), tests/helpers.ts, pgTAP harness, supabase/seed.sql

**Context:**
- Supabase port collision hit day-of: sailbook holds 54321–54329; bumped bushel to 54421–54429. Both stacks run simultaneously now.
- Admin OAuth testing: `LocalForward 3001 localhost:3001` in `~/.ssh/config` on laptop makes localhost:3001 always resolve to mill-dev dev server. Google rejects `http://mill-dev:3001`; customer-side uses `mill-dev:3001` (token URLs, no OAuth — not a gap).
- `.env.local` currently points at cloud Supabase (OAuth works). Local stack URL commented out at top of `.env.local` for easy swap when doing migration/pgTAP work.
- Separate Supabase accounts (bushel vs sailbook) for LTSC billing handoff. Remote CLI commands need `SUPABASE_ACCESS_TOKEN` env var — pattern in `CLAUDE.md` + memory.
- `gen_random_bytes` unavailable on cloud Supabase (pgcrypto search_path issue); fixed token default to `replace(gen_random_uuid()::text, '-', '')` — no extension dependency.
- Pull-seeds test aborted: seeds repo has no `seeds-version` file at root; compatibility gate fails. User will fix seeds-side before next pull-seeds attempt.
- Phone OAuth not supported locally (Google rejects mill-dev). Admin is desktop-only; customer-side is token-based. Not a real gap.

**Code Review:** 2 security/bug findings (open redirect in `/auth/callback`, empty origin fallback in `login/actions.ts`), 1 UX bug (silent auth errors on `/login`), 2 consistency notes. All advisory — address before next feature touching the auth flow.
