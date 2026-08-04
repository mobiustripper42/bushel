---
id: DEC-052
title: "bushel-mobile is an independent seeds project; a phase never spans repos"
topic: "Stack, platform & environments"
---

## DEC-052: bushel-mobile is an independent seeds project; a phase never spans repos

Decision: bushel-mobile (DEC-050's separate Expo repo) is a fully independent
seeds-managed project — own CLAUDE.md shell + CLAUDE-context.md, own skills/agents,
own orphan `sessions` branch, own SemVer/CHANGELOG/tags, phases numbered from 1, own
`/retro`. It is NOT a satellite of bushel. Standing invariant: a phase is a single-repo
accounting unit — issues, PRs, session files, version bumps, and retro all live in one
repo. Work is never one phase spanning two repos.

Phase 11 re-frame:
- 11.1 (#261, 5pt, /api routes + bearer guard) stays a bushel phase — bushel code,
  bushel issue, bushel retro/version. Mutations built as service-layer functions with
  the /api route as a thin wrapper (DEC-050 parity mechanism 1).
- #262–#265 close in bushel ("moved to bushel-mobile"), recreated as bushel-mobile
  Phase 1 issues (15pt). bushel PROJECT_PLAN Phase 11 = 5pt; bushel-mobile Phase 1 = 15pt.
  There is no single "20-pt Phase 11" — that framing was the bug.

Mechanics:
- Cross-repo `closes` does not auto-close; bushel-mobile PRs `closes` its own issues.
  The 11.1 dependency is a plain cross-repo mention.
- Sessions are single-repo (cwd-delimited); same Claude window may run separate sessions
  in each repo.
- project-type = `webapp` (no `mobile` type invented for one repo); DB/migration/Playwright
  steps marked N/A or overridden in CLAUDE-context.md.
- DEC-050's per-phase web↔app parity pass is owned by bushel-mobile's retro (downstream
  repo carries the obligation so it can't be dropped).

Why: the seeds machinery is single-repo by construction (sessions worktree, gh defaults,
per-repo SemVer, DEC-S026 issue-based throughput). An Expo app's own package.json forces
an independent version line, making a shared-ledger satellite impossible. Splitting at the
repo boundary lets every skill run unmodified. Sets no precedent for muster (per DEC-050).

Relates: DEC-050 (repo shape), DEC-047 (bearer session), DEC-S013/S014/S022/S026 (workflow),
DEC-S011 (project-type).

---

## Open / Pending Product Owner Discussion

- **Minimum delivery amount (in dollars).** Threshold below which delivery is unavailable, or above which delivery is free. Phase 7+ candidate.
- **Multi-unit product count (DEC-032).** Confirm with Annabel how many V1 products need multi-unit. If small (~3), V1.5 framing holds; if large, pull DEC-032 forward into V1.
