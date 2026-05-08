---
session: 7
dev: eric
slug: phase-1-first-task
branch: main
started: 2026-05-07T13:34:35Z
ended: 2026-05-08T02:24:55Z
duration: 12.83
points: 11
status: closed
transcript: /home/eric/.claude/projects/-home-eric-bushel/80f71b5f-6194-4f9e-995c-a57b65085313.jsonl
---

# Session 7 — phase-1-first-task

**Task:** Phase 1.1a, 1.1b, 1.2 — Schema design, migrations, and RLS policies (#16, #17, #18)

**Completed:**
- 1.1a: Created `docs/SCHEMA.md` — 9 tables finalized (codes, users, products, customers, pickup_windows, ordering_schedule, orders, order_items). Introduced codes table pattern for lookup values. PR #21, closes #16.
- 1.1b: Squashed Phase 0.3 customers scaffold into single clean `initial_schema` migration. All indexes, constraints, RLS stubs, TypeScript types regenerated. PR #22, closes #17.
- 1.2: RLS policies for all tables (service-role-as-gate + RLS-as-backstop). 33 pgTAP tests (43 total). PR #23, closes #18.
- Fixed `supabase db reset*` incorrectly in user-level deny list — moved to allow.
- Added MCP playwright tools to project allowlist.
- Remote synced: migration repair + db push applied both 1.1b and 1.2 to Supabase Cloud.

**In Progress:** nothing

**Blocked:** nothing

**Next Steps:**
1. Cut `task/1.3-admin-auth` and start #19 — admin route group, Google OAuth, admin guard middleware
2. Pre-Phase 4 cleanup (low urgency, batch into any Phase 1 PR): SVG raw hex → `--leaf-500`, `.callout-sub` in customer.css, extract farm constants to `src/lib/farm.ts`

**Context:**
- `codes` table: PK `(type, code)`, seeded with fulfillment_type and order_status rows; app-enforced (no DB FK from orders)
- `ordering_schedule` is a singleton — always UPDATE, never INSERT a second row (`is_singleton` guard column)
- `week_of` on orders: use `date_trunc('week', now() AT TIME ZONE 'America/New_York')::date` — Ohio-only, DST handled by IANA tz
- pgTAP `SET LOCAL ROLE` reverts on savepoint rollback inside pgTAP functions — bare INSERT tests as anon unreliable; use `throws_ok` instead
- `notification_preference` on customers stays as CHECK constraint (not in codes) — deliberate DEC-020 deviation for v2 email expansion
- `users` write policy restricted to own row (prevents is_admin self-escalation before 1.3 lands)

**Code Review:** All three PRs clean after fixes. Key findings resolved: codes RLS missing (fixed), users write policy too permissive (fixed), pgTAP token inserts missing (fixed), cross-customer isolation test added.
