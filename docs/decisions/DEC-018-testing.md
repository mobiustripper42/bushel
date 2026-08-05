---
id: DEC-018
title: "Testing"
topic: "Testing"
---

## DEC-018: Testing

**Decision:** Mirror sailbook patterns:
- Playwright-only E2E (no Vitest unit suite)
- pgTAP RLS tests via `supabase test db`
- Local Supabase via Docker
- Three Playwright projects: mobile (375×667), tablet (768×1024), desktop (1440×900)
- `workers: 1` everywhere (revised — see DEC-023 for the rationale; flake-resistance dominated theoretical parallel-speed benefit at this scale), 2 retries, `forbidOnly: true` in CI
- `tests/helpers.ts` for shared auth/fixtures
- `supabase/seed.sql` for pre-seeded test data
- GitHub Actions CI runs both `playwright test` and `supabase test db`

---
