# Retrospectives

## Phase 2 — 2026-05-12

**Duration:** 17.87h across 3 sessions (13, 14, 15)
**Points completed:** 10 / 10 (100%) — plus #27 admin-shell carry-over from Phase 1 (unlabeled)
**Velocity:** 1.79 hrs/pt
**Issues:** 5 closed (#27, #35, #41, #32, #33), 0 moved to Phase 3, 0 descoped

### What worked
- it ended

### What didn't
- not checking the screen designs in the DESIGN folder cuased wasted sessions and redo of work

### Changes for next phase
- I will need to read much closer what is going on. This was 100% my fault for trying to do too much

### Scope changes
- 2.1 inventory editor shipped twice — first attempt (PR #44 in session 14) missed `design/admin-inventory.jsx` and was rebuilt in PR #57 in session 15. App-wide design system (`src/styles/app.css` + `src/components/ui/`) was stood up alongside the redo since the inventory page is the first consumer.
- 3.1 admin-customers also shipped against wrong spec in session 14; orphaned, to be rebuilt in Phase 3.
- #27 (authenticated admin Playwright tests) carried over from Phase 1 and closed in session 13 alongside 2.0a/2.0b.

### PM read

Phase 2 shipped 10 labeled points in 17.87 hours — 1.79 hr/pt, up from Phase 1's 1.13 and Phase 0's 0.66. Read straight, that's a 60% slowdown phase-over-phase and a near-tripling since the start. The headline cause is that two of three feature tasks shipped against the wrong spec and had to be rebuilt: 2.1 inventory editor took two passes, and 3.1 customers is heading for the same treatment in Phase 3. Strip out the redo work and Phase 2 looks closer to Phase 1; leave it in and the regression is real. Both framings are true and both matter — the rebuild hours are real hours spent, and they'll keep being real hours until the design-folder miss stops happening.

Scope held — no new tasks materialized mid-phase, and DEC-029/030/031/032 were captured cleanly in session 13 before code went down. That's the encouraging part: the planning surface worked. The execution surface is where the time went. Worth flagging separately: session 15 spent roughly half its 0.92h on CSS-architecture relitigation (per-page → monolithic → app-wide design system) before any code shipped. The landing place was correct, but two pushbacks worth of meandering ate budget. That's a pattern worth watching — when an architectural question is open, naming the three options up front and asking for a pick is cheaper than proposing-then-revising.

To your three answers, in order. "It ended" — fair. I'll take it. On the design folder: agreed it was the dominant cost, and the data backs you up — three misses across two sessions, on a rule that's been in CLAUDE.md the whole time and got a "READ FIRST" header bolted on after the second miss. What I'd push on is the framing that this was 100% your fault for trying to do too much. The rule is in the file. The agent should be reading the file. Two of those three misses were mine to catch and I didn't. "Read closer next phase" is a fine commitment from you; the matching commitment from this side is that before any file under `src/app/admin/` or `src/components/admin/` gets touched in Phase 3, the matching `design/*.jsx` gets read first, no exceptions. If it happens a fourth time the rule has failed as a rule and needs a mechanism — a pre-edit hook, an agent gate, something the harness enforces instead of trusting prose.

Forward note for Phase 3: 3.1 redo is the immediate test of whether the design-folder discipline holds. It's also the second consumer of the new `app.css` primitives stood up in session 15, which is the right shape — the design system gets validated by a second page before it gets locked in. The carry-forward worth not losing: `app.css` / `customer.css` overlap (both define `.btn` with subtle divergence) needs resolving by 3.4 before customer routes go live, and the regenerate-token-before-send-weekly-link constraint from 3.0 needs to land hard in 3.2 so no `placeholder-*` token ever reaches a customer URL. Phase 3 is 34 pts as materialized — at Phase 2's 1.79 hr/pt that's 60h of work, at Phase 1's 1.13 it's 38h. Worth knowing which trajectory we're on by the end of the first task.

---

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
