---
id: DEC-023
title: "Testing philosophy"
topic: "Testing"
---

## DEC-023: Testing philosophy

**Decision:** Two principles for test discipline in bushel:

1. **Test the user, not the function.** Coverage weighted toward integration (Playwright + API + RLS via pgTAP) over unit tests. Unit tests reserved for genuinely stable utilities (date math, validation, parsing). Avoids brittle implementation-coupled tests that break on every refactor.

2. **Test-first when behavior changes.** When a feature's behavior changes, update the test FIRST (it goes red), then change the code (it goes green). If the test is hard to write, the new behavior isn't decided yet — think before coding. Lagging tests (chasing code changes) become a record of what code does, not what we want; they stop catching real regressions.

**Why:** Pre-bushel pattern was whole sessions spent fixing tests that broke from implementation shifts. Both principles attack that root cause directly. The second is the higher-leverage one — it's the discipline that prevents the pattern from re-emerging.

**Operational implications:**
- Local: fast unit + critical-path integration only. Sub-10-second feedback.
- CI (Vercel): full integration, E2E across browser matrix, lint, types, security. `workers: 1` on CI to mute parallel-state flakiness; revisit when CI time becomes painful.
- Browser matrix: Chromium on every PR (fast feedback). Full matrix incl. WebKit on main / release. WebKit included on PR for the customer-side mobile component (DEC-019).

---
