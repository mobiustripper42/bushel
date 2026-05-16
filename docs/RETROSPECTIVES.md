# Retrospectives

## Phase 4 — 2026-05-16

**Sessions:** 1 (S24)
**Points:** 11 / 11 (100%)
**Wall clock:** 13.7h (overnight)
**Active time (wall − breaks):** 3.0h ← honest headline
**Dev time (per DEC-013 math):** 0.3h¹
**Review time (per DEC-013 math):** 2.3h
**Velocities:**
- Wall: 1.24 h/pt
- **Active: 0.27 h/pt** ← use this for Phase 5/6 forecasting (faster than Phase 3's 0.35)
- Dev: 0.024 h/pt ← DEC-013 method artifact (5 PRs in one session); do not trust as headline
**Issues:** 4 created, 4 closed (#87–#90); 0 moved.

¹ DEC-013's `dev_time` formula defines the dev window as "session start → first PR opens." When a session opens N PRs and keeps coding between them (as this one did), all subsequent dev work gets attributed to `review_time`. Phase 3 retro flagged this; Phase 4 reproduces it. Multi-PR session math is an unresolved seeds-template issue.

### Per-session breakdown
| Session | Date       | Wall | Dev  | Review | Breaks | Points | PRs                |
|---------|------------|------|------|--------|--------|--------|--------------------|
| 24      | 2026-05-15 | 13.7 | 0.3¹ | 2.3    | 10.7   | 11     | 92, 93, 94, 95, 96 |

### What worked
- Development work on the tasks was done efficiently.

### What didn't
- This last bit of debugging with the preview was incredibly frustrating.

### Changes for next phase
- Not for next phase, but the next project — phases are too small, need more points. *(Backport target for `/push-seeds`.)*

### Scope changes
- **DEC-033 added** (admin order-arrival alert pivoted from email → Telegram bot push). DEC-027 marked superseded. Decided in planning conversation before any code shipped.
- **DEC-034 amending DEC-019** (admin desktop-only): `/admin/send` is mobile-required because operator-sent `sms:` deep links only resolve on a phone. Discussed but not yet logged to DECISIONS.md.
- **Three new Phase 6 tasks proposed** (mobile-admin work): 6.4 `/admin/send` mobile-responsive (3 pts), 6.6 admin shell responsive (5 pts), 6.7 desktop SMS-relay via clipboard + messages.google.com (2 pts). Discussed but not yet logged to PROJECT_PLAN.md.
- **PR #95 stacked-PR misfire:** merged into parent branch `task/4.2-send-queue-page` after #93 had already merged to main, stranding 4.4 commits. Re-PR'd as #96. Process gap — GitHub doesn't auto-retarget stacked children when the parent merges.

### PM read
Phase 4 came in at 11 points planned, 11 delivered, in one overnight session. Read straight against Phase 3's 36 labeled / 56 counted points, it's a quarter of the work — and the active-time number (3.0h, 0.27 h/pt) is actually faster than Phase 3's 0.35 h/pt headline. The dev/review split is the same DEC-013 artifact flagged last retro: five PRs in one session converts most real coding into "review_time" by the formula, dropping dev_time to a fictional 0.3h. Quote 0.27 h/pt active as the Phase 4 number and keep footnoting the DEC-013 math until the skill spec catches up to multi-PR sessions.

Scope was the cleanest it's been. The DEC-027 → DEC-033 pivot to Telegram is the kind of mid-phase decision worth defending — caught in planning, not in code, and the new decision retired the old one explicitly. Compare to Phase 2, where a wrong-spec inventory editor took two passes to surface. The mockup-vs-AC conflict on 4.2 (pre-DEC-026 broadcast UI vs per-customer queue) was the test of whether the design-folder discipline holds, and the answer was yes: surfaced the conflict, got a pick, built once. That's the rule working as intended for the case it wasn't originally written for. Worth extending CLAUDE.md's "stop and ask if no design exists" to "stop and ask if design contradicts AC" — the session file already names this.

Two patterns in the session file are worth pulling forward. First, the stacked-PR misfire on #95 → #96 is a process gap, not a one-off — GitHub doesn't retarget stacked children when the parent merges, and the child silently lands on a dangling branch if you click merge. The fix (retarget child to main before parent merges, or base on main from the start) belongs in CLAUDE.md alongside the existing stacking guidance. Second, the `data-customer-id` discipline born from dev-DB-duplicates contamination is now the right default for any spec that has to coexist with real data — generalize it before Phase 6 admin work touches the same tables. The recurring `lsof -ti:3001` ritual and cross-spec leakage from admin-customers are still drag; they're noted in the CHEATSHEET territory the Phase 3 retro asked for.

On your three answers. "Development work was done efficiently" — yes, and the numbers back it: 11 points in 3 active hours is the new shape, not a fluke. "The preview debugging was incredibly frustrating" is the answer worth pressing on. That hour wasn't a bug in your code — it was `NEXT_PUBLIC_*` env vars baking at build time, a stale preview deployment, and an earlier accidental production-scope tag on the preview branch. Three coupled systems (Vercel build cache, Vercel env-var scoping, Supabase OAuth redirect allowlist) each with non-obvious failure modes, and the symptom (auth bounces to localhost) doesn't point at any of them directly. The preview-rebind ritual in CLAUDE.md covers the DNS and OAuth pieces but doesn't address build-time env baking; that's a CLAUDE.md gap, not user error. On "the phases are too small, need more points for the next project" — agreed, with a caveat. Phase 4 at 11 pts is the floor of where the retro-and-planning overhead breaks even with the work. Phase 3 at 36/56 was the right size. The lesson for the next project isn't "make phases bigger" in the abstract — it's "don't carve sub-10-point phases unless there's a hard scope boundary," which Phase 4 had (notifications stack is one coherent thing). Worth distinguishing scope-bounded small phases from arbitrary-cut small phases when planning.

Forward note for Phase 6. The carry-over count is climbing: #53, #69, #63, #61 from Phase 3's relabel, plus the three mobile-admin tasks (6.4, 6.6, 6.7) discussed this session but not yet logged, plus DEC-034. At Phase 4's 0.27 h/pt active that's a 4–6 hour phase if it stays at 17–25 points; at Phase 3's 0.35 it's 6–9 hours. The risk isn't velocity, it's that Phase 6 is now genuinely the catch-all the Phase 3 retro warned about. Bound it at the front before `/start-phase`: which of the carry-overs are V1-blocking, which are V1.5, which are post-launch polish. Otherwise it'll quietly grow another 10 points between now and start.

---

## Phase 3 — 2026-05-15

**Sessions:** 9 (S15–S23)
**Points:** 36 labeled (29 plan + 7 polish) shipped; 56 counted in session files (includes 20pt non-labeled mid-phase work)
**Wall clock:** 49.25h
**Active time (wall − breaks):** 19.42h ← honest headline
**Dev time (per DEC-013 math):** 8.67h
**Review time (per DEC-013 math):** 10.75h
**Velocities:**
- Wall: 0.88 h/pt
- Active: **0.35 h/pt** ← use this for Phase 6 forecasting
- Dev: 0.15 h/pt ← DEC-013 method artifact under multi-task sessions; do not trust as headline
**Issues:** 11 created, 10 closed (#45–#52 + #66, #67), 1 moved (#53 → Phase 6); 3 unrelated open issues (#69, #63, #61) also relabeled to Phase 6

### Per-session breakdown
| Session | Date       | Wall | Dev | Review | Breaks | Points | PRs |
|---------|------------|------|-----|--------|--------|--------|-----|
| 15      | 2026-05-12 | 0.92 | 0.92 | 0.00 | 0.00 | 5      | —   |
| 16      | 2026-05-12 | 14.17 | 0.75 | 1.50 | 11.92 | 3      | #59 |
| 17      | 2026-05-13 | 0.42 | 0.42 | 0.08 | 0.00 | 5      | #64 |
| 18      | 2026-05-13 | 4.25 | 2.67 | 1.58 | 0.00 | 0      | #68 *(transcript-unavailable)* |
| 19      | 2026-05-14 | 1.42 | 1.33 | 0.08 | 0.00 | 3      | #70 |
| 20      | 2026-05-14 | 10.33 | 0.50 | 2.50 | 7.33 | 8      | #72, #73, #74 |
| 21      | 2026-05-14 | 5.50 | 0.83 | 2.58 | 2.08 | 11     | #76, #77, #78 |
| 22      | 2026-05-14 | 2.83 | 0.75 | 1.33 | 0.75 | 10     | #80, #81 |
| 23      | 2026-05-15 | 9.42 | 0.50 | 1.08 | 7.75 | 11     | #83, #84, #85, #86 |

### What worked
- Issues in GitHub are a great place for status. Keeper. (Backed by data: every session opened with a clear AC; rebuild count went from 2-of-3 in Phase 2 to zero this phase.)

### What didn't
- Still getting workflow dialed, some pain.

### Changes for next phase
- Try to stick to tasks in phase. Add new issues to Phase 6 then evaluate.

### Scope changes
- **Added mid-phase:** #66 (admin shell polish, 5pt) and #67 (pgTAP DEC-029/030 coverage, 2pt) — driven by session 18 audit finding shipped layout drifted from `design/admin-shell.jsx` mockup and schema-shape pgTAP coverage was missing.
- **Moved to Phase 6:** #53 (Phase 3.8 realtime, 5pt) — original "ship-or-skip" exit clause; user elected defer.
- **Also relabeled to Phase 6** (not from Phase 3, just clearing the backlog of label-less open issues at phase boundary): #69 (preview-rebind infra), #63 (admin auth guard), #61 (deactivated-customers UI).

### PM read
Fifty-six points in 19.4 active hours is credible but only if you read "active" honestly. The dev-time number (8.67h, 0.15 h/pt) matches sailbook's best-ever and shouldn't be trusted — it's the artifact, not the velocity. The 0.35 h/pt active read is the real one, and it's an enormous step down from Phase 2's 1.79 and Phase 1's 1.13. Two things drove it: the design-folder discipline actually held this phase (no rebuilds), and stacking 3–4 tasks per session amortized the context-load overhead that killed earlier phases. Session 23 shipping 11 points in one window is the new shape.

The DEC-013 math artifact will skew forecasting if left alone. Skill spec assumes one PR per session, so for sessions 20/21/22/23 the "first PR open" moment converts the remaining task work into review_time. Result: dev_time looks 2–3x faster than it is, review_time looks 2–3x slower, and any phase that mixes single-task and multi-task sessions will have incoherent per-session numbers. Recommendation: until the math is fixed in the skill, quote 0.35 h/pt active as the Phase 3 headline and footnote the 0.15 dev as "method artifact." Phase 6 forecasting should use 0.35, not 0.15.

On the user's three answers. "Issues in GitHub are a keeper" — agreed, the data backs it; every session opened with a clear AC and the rebuild count went from 2-of-3 features in Phase 2 to zero this phase. "Still getting workflow dialed, some pain" is the answer worth pressing on — the pain in the session files is specific, not vague: stale `next start` workers on port 3001 burned cycles in sessions 22 and 23 ("second time burned this"), stale `.next` cache hid a favicon ship in session 23, and the cross-button submit race in session 21 was the kind of bug that only surfaces under multi-task velocity. "Read more carefully" is not the lesson. The lesson is: when sessions stack 3+ tasks, the gotchas-per-task ratio rises and the kill-the-server / clear-the-cache muscle memory has to come with it. Worth a one-page CHEATSHEET addition, not another resolution to focus.

Forward note for Phase 6. You planned 10 points; #53, #69, #63, #61 push it to 17+ before a single new task is opened. At 0.35 h/pt that's ~6 hours of active work — fine. But "stick to tasks in phase and add new issues to Phase 6 then evaluate" only works if Phase 6 closes; right now it's collecting everything that didn't fit. Either bound it at the front (pick which of the four carry-overs are actually V1-blocking, defer the rest to V1.5) or accept that Phase 6 is the catch-all and rename it. Naming it honestly is cheaper than letting it slowly become a second 3.8.

---

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
