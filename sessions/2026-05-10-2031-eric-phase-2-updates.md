---
session: 12
dev: eric
slug: phase-2-updates
branch: plan/phase-2-updates
started: 2026-05-10T20:31:33Z
ended:
duration:
points:
status: open
transcript: /c/Users/eric/.claude/projects/C--Users-eric-OneDrive-Documents-GitHub-bushel/3acccb73-4f06-4444-bfaf-629ab073d880.jsonl
---

# Session 12 — phase-2-updates

**Task:** Planning session — review Phase 2/3 spec with PO feedback; capture decisions and update plan

**Completed:**
- DEC-029: free-text fulfillment per order; supersedes DEC-013 (structured pickup windows dropped)
- DEC-030: ordering window defaults to "always open, manually closed"; amends DEC-011
- DEC-031: sold-out display — per-item disabled at qty=0; page-level empty state when all visible items sold out
- DEC-032: multi-unit products moved to a new V1.5 phase (Phase 6.5, ~15 pts); per-unit pricing independent (NOT per-customer pricing — DEC-007 still defers that to V2)
- SCHEMA.md: removed `pickup_windows` table section; added `orders.pickup_note` + `orders.delivery_preference`; flipped `ordering_schedule.is_open` default; updated Trade-offs
- PROJECT_PLAN.md: new task 2.0b (1 pt) for migration; task 3.4 8→5 pts; task 3.6 description tweak (manual default); task 3.7 description expansion; new Phase 6.5 with 6 tasks; v1 totals recomputed 108→106 (all-in) / 103→101 (3.8 dark); resolved "drop open/close entirely?" open question
- CLAUDE.md: Core Data Model updated to reflect free-text fulfillment + send_weekly_link

**Decisions confirmed (no doc change needed):**
- Customer order confirmation flow (on-screen + Annabel SMS via Phase 4.2) is correct as speced
- Customer comments textarea: add to task 3.4 (now folded into the 5-pt re-estimate)
- Per-customer pricing stays deferred to V2

**Open question added:**
- Multi-unit product count — confirm with Annabel how many V1 products genuinely need multi-unit. If small (~3), V1.5 framing holds; if large, pull DEC-032 forward into V1.

**In Progress:** nothing

**Blocked:** nothing

**Next Steps:** PR this branch into main (planning-only — no code, doc updates plus session log). Resume task 2.1 (inventory editor) once merged. Confirm DEC-032 multi-unit count with Annabel before Phase 6.5 starts.

**Context:**
- This was a pure planning session — no production code touched. Only docs.
- The "weekly SMS link is the practical traffic gate, not the open/closed toggle" insight is captured in DEC-030 — worth remembering when reasoning about ordering-window behavior.
- DEC-032's V1/V1.5 split was a deliberate choice to ship V1 sooner; can be reversed if Annabel confirms many products need multi-unit.

**Code Review:** N/A — docs-only branch
