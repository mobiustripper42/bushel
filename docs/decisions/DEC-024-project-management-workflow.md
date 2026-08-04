---
id: DEC-024
title: "Project management workflow"
topic: "Workflow & process"
---

## DEC-024: Project management workflow

**Decision:** Hybrid PROJECT_PLAN.md + GitHub Issues + Project board.

- `docs/PROJECT_PLAN.md` is a **phase-boundary document**: read at planning, written at retro. Untouched mid-phase. Holds phase narratives, scope, velocity table.
- The **current phase's tasks materialize as GitHub Issues** with labels `phase:N` and `points:X`. Closed via PR's `closes #N`.
- A GitHub Project board (Projects v2) gives kanban visibility for multi-dev work.
- Per-session files under `sessions/` (`YYYY-MM-DD-HHMM-<dev>-<slug>.md`) replace the legacy monolithic `session-log.md`.

**Why:** Solo + scaling-to-2-devs (Josh joins for stewardship). Single PROJECT_PLAN.md was a merge bomb at >1 dev. Issues give per-task assignee + comment thread + mobile review. Phase-boundary writes eliminate plan-file contention.

**Rituals:**
- `/start-phase` materializes a phase: reads tasks from PROJECT_PLAN.md, creates Issues, writes `#N` references back into the plan, adds to board.
- `/retro` closes a phase: marks `[x]`, reconciles drift (mid-phase additions), computes phase velocity, writes to RETROSPECTIVES.md.

**Trade-off accepted:** mid-phase scope changes create temporary drift between Issues (truth) and PROJECT_PLAN.md (read-only until retro). Reconciliation at retro restores alignment, with inline annotations preserving the story.

---
