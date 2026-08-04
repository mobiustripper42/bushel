---
id: DEC-051
title: "Test stack: vitest (unit + pg-integration) + Playwright (E2E-only); pgTAP retired with Supabase"
topic: "Testing"
amends:
  - id: DEC-048
    relation: amends
    scope: "the pgTAP disposition only — the RLS-deleted, service-layer-is-the-boundary holding stands"
---

## DEC-051: Test stack: vitest (unit + pg-integration) + Playwright (E2E-only); pgTAP retired with Supabase

**Decision:** Two layers. **vitest** owns unit tests (pure logic — HMAC session, login-code, conversion math) and **DB-integration** tests (the plpgsql functions + constraints + triggers, driven through the app's own `src/lib/db` pool against docker Postgres). **Playwright** owns end-to-end user flows only. pgTAP is retired.

**Why:** pgTAP was only ever viable because Supabase ships the extension and `supabase test db` ran it in one command. Off Supabase (DEC-046/047), keeping it means baking a test-only extension into the Postgres image and running a Perl TAP harness — infrastructure that exists solely to preserve a Supabase-era format. The concurrency-critical logic (atomic `place_order`) correctly stays in plpgsql; only the *harness* was Supabase-shaped. Testing those functions through the pg driver from TypeScript is the canonical "integration test against a real DB" pattern — same runtime + assertions as the rest of the code, no extension, no pg_prove — and it's where muster landed too. It also finally gives bushel a unit layer (10.3's HMAC/login-code logic had none).

**Shape:** vitest owns `*.test.ts` under `src/` (pure) and `db/tests/` (pg-integration; skips cleanly when no DB is reachable, so `npm run test:unit` stays docker-free for the pure units). Playwright keeps `tests/*.spec.ts`. Different suffix + dir → zero overlap. Integration files run non-parallel (`fileParallelism: false`) since they share one DB and truncate between tests. CI runs `npm run test:unit` where `supabase test db` used to be.

**Amends DEC-048:** its "keep the 6 function/data pgTAP files green on docker Postgres" becomes "port the 6 to vitest pg-integration tests"; the 3 RLS-only pgTAP files are deleted (RLS is gone). `supabase/tests/` is removed entirely.

---
