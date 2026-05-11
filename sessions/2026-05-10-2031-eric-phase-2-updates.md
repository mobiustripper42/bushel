---
session: 12
dev: eric
slug: phase-2-updates
branch: plan/phase-2-updates
started: 2026-05-10T20:31:33Z
ended: 2026-05-11T01:58:47Z
duration: 5.45
points: 0
status: closed
transcript: /c/Users/eric/.claude/projects/C--Users-eric-OneDrive-Documents-GitHub-bushel/3acccb73-4f06-4444-bfaf-629ab073d880.jsonl
---

# Session 12 — phase-2-updates

**Task:** Phase 2/3 planning — review spec with PO feedback, capture 4 new DECs, update plan

**Completed:**
- DEC-029: free-text fulfillment per order; supersedes DEC-013 (structured pickup windows dropped)
- DEC-030: ordering window defaults to "always open, manually closed"; amends DEC-011
- DEC-031: sold-out display — per-item disabled at qty=0; page-level empty state when all visible items sold out
- DEC-032: multi-unit products carved into new V1.5 phase (Phase 6.5, ~15 pts); per-unit pricing independent (NOT per-customer — DEC-007 still defers that to V2)
- SCHEMA.md: removed pickup_windows table; added orders.pickup_note + orders.delivery_preference; flipped ordering_schedule.is_open default; refreshed Trade-offs
- PROJECT_PLAN.md: new task 2.0b (1 pt migration); task 3.4 8→5 pts; new Phase 6.5 with 6 tasks summing to 15 pts; v1 totals recomputed (108→106 all-in / 103→101 with 3.8 dark); resolved "drop open/close entirely?" open question; dropped stale "four pickup window times" line
- CLAUDE.md: Core Data Model block updated for free-text fulfillment + send_weekly_link
- @code-review follow-up: DEC-011 amendment marker added; stale "four pickup window times" open question removed
- PR [#39](https://github.com/mobiustripper42/bushel/pull/39) merged into main

**Decisions confirmed (no doc change needed):**
- Customer order confirmation (on-screen + Annabel SMS via Phase 4.2) — already correctly speced
- Customer comments textarea — folded into 3.4 re-estimate, no separate task
- Per-customer pricing stays deferred to V2

**In Progress:** nothing

**Blocked:** nothing

**Next Steps:**
1. Pick up task 2.1 (inventory editor, 5 pts) — or do task 2.0b first if you want the schema migration to precede the editor work
2. Confirm DEC-032 multi-unit count with Annabel before Phase 6.5 starts

**Context:**
- Pure planning session — no production code. Docs + session log only.
- The "weekly SMS link is the practical traffic gate, not the open/closed toggle" insight is captured in DEC-030 — worth recalling when reasoning about ordering-window UX.
- Pre-existing arithmetic drift in v1 point totals (sub-tasks sum to 108/103 vs stated 106/101) flagged in code review; left for next retro to audit.
- Pre-existing drift in SCHEMA.md (`notification_preference` not yet updated to `send_weekly_link` per DEC-028) — separate doc-sync ticket worth opening later.
- Long clock-time duration (5.45 hr) reflects a multi-hour gap between draft hand-off and PR merge; active conversation time was shorter.

**Code Review:** Two consistency fixes addressed pre-PR (DEC-011 amendment marker, stale open-question line); two pre-existing drifts flagged but not addressed.
