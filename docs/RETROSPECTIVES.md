# Retrospectives

## Phase 1 — 2026-05-08

**Duration:** 18.0h across 3 sessions
**Points completed:** 16 / 16 (100%)
**Velocity:** 1.13 hrs/pt
**Issues:** 5 created, 5 closed, 1 moved to Phase 2 (#27)

### What worked
- Tasks finished quickly

### What didn't
- Human was slow. During debugging complex issue, human needs one step at a time

### Changes for next phase
- Nothing

### Scope changes
- #27 (authenticated admin Playwright tests) moved to Phase 2 — blocked on headless auth path, not descoped

### PM read

**Pace vs Phase 0:** Phase 1 came in at 1.13 hrs/pt against Phase 0's 0.66 hrs/pt — a 71% slowdown. Both are well above the sailbook baseline of 0.15–0.35 hrs/pt, so this isn't surprising for a project still finding its rhythm, but the trend is moving the wrong direction. The Phase 0 estimate for Phase 1 was 2.4–5.6 hours; actual was 18.0. That's a 3–7x miss. Part of that is the plan bracket being unrealistically tight (the conservative estimate assumed sailbook velocity, which bushel hasn't hit yet), but part of it is real: auth debugging in session 9 consumed meaningful time on work that wasn't on the task card.

**Scope delivery:** Clean. All 16 planned points closed. The one slip — #27, authenticated Playwright tests — was correctly triaged as blocked rather than abandoned, and the block is legitimate (headless Google OAuth is a genuine gap, not scope creep). The schema work in 1.1a/1.1b was notably crisp: the codes table pattern and the singleton guard on ordering_schedule are the kind of deliberate choices that prevent later pain. RLS backstop + service-role-as-gate is the right architecture and the pgTAP coverage (43 tests) is solid. Code review caught real bugs on every PR, which is the system working.

**Patterns worth noting:** The 12.83-hour session 7 is worth flagging — not as a problem, but as a data point. That session covered 11 points across three PRs with no rework after code review landed. Sustained output at that clip is unusual and shouldn't be treated as the baseline for planning. Session 9 tells a more representative story: 4.9 hours, 5 points, a real debugging episode (the `Host` header / 0.0.0.0 issue), and an issue created mid-session when a task hit an unexpected wall. That's the normal shape of a working session on this project.

**On the user's answers:** "Tasks finished quickly" and "human was slow" pointing at the same phase is coherent — the work itself moved when it moved, and the friction was in the handoffs during a complex debug sequence. The ask for one step at a time during hard debugging is worth internalizing. The `auth/callback` origin issue in session 9 was exactly that kind of moment: multiple interacting variables (Next.js binding, Supabase Site URL, Google OAuth redirect, `?next` threading), and a waterfall of changes is the wrong approach there. Slow and confirmatory is correct. "Nothing" for changes next phase is a reasonable answer when scope landed cleanly — but it implies the debugging pace is acceptable, which is only true if the bugs stay in the same complexity band.

**Forward look on Phase 2:** Phase 2 is 7 points (inventory editor + pre-populate action), estimated 1.05–2.45 hours at planning. Given actual velocity, the realistic band is 7–8 hours. The inventory editor (2.1, 5 pts) is the only task worth watching — "spreadsheet-style row form" can expand if it makes contact with real data complexity (partial quantities, per-customer availability, sold-out handling). None of those are V1 scope per SPEC.md, but they're adjacent enough to invite drift. Cut them on contact. Issue #27 (authenticated Playwright tests) rides along into Phase 2 and is a dependency for any test that requires an admin-authenticated session — that needs a resolution path before Phase 2 closes, not after.

---

## Phase 0 — 2026-05-07

**Duration:** 25.3h calendar across 5 sessions (11.28h worked)
**Points completed:** 20 / 19 planned (17 via issues + 3 pre-issue for task 0.1; 0.3 re-estimated to 3 pts at execution)
**Velocity:** 0.66 hrs/pt
**Issues:** 5 created, 5 closed, 0 moved to Phase 1

### What worked
- Issues are nice, better for me than looking in the project plan. Tasks were manageable size.

### What didn't
- Not 100% part of this project but still dialing in workflow and that causes disruptions in dev flow.

### Changes for next phase
- Better use of skills.

### Scope changes
- Task 0.1 completed pre-issue in seeds session 15 (2026-05-03).
- Task 0.3 re-estimated from 2 pts to 3 pts at execution.
- No tasks moved out or descoped.
