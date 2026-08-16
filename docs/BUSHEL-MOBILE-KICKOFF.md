# Kickoff — bootstrap `bushel-mobile` (Phase 11 mobile app)

**For:** a fresh Claude Code session with **three repos connected**: `bushel` (this repo, the
Next/pg backend), `bushel-mobile` (the Expo repo — you will create it), and the **seeds**
template repo (the source everything below is copied from, by hand). Read this doc + the referenced
issues/DECs, then execute. You have authority to move + re-spec the app tasks as you go.

**Not for:** the `bushel` side of Phase 11 — task **11.1 (#261)** is being done separately in
`bushel` by the human. Coordinate on it (below) but don't build it here.

---

## The decision (write this DEC first)

@architect ruled on the two-repo structure (2026-07-06). **`bushel-mobile` is a fully
independent seeds-managed project, NOT a satellite of bushel. A phase never spans repos.**
The seeds machinery is single-repo by construction (sessions worktree, `gh` defaults,
per-repo SemVer on `main`, DEC-S026 retro-from-issues); an Expo app's own `package.json`
forces an independent version line, so a shared-ledger satellite is impossible, not just
awkward. Split at the repo boundary and every skill runs unmodified.

**Step 1 — add DEC-052 to `bushel/docs/DECISIONS.md`** (append after the last DEC):

```
## DEC-052 — bushel-mobile is an independent seeds project; a phase never spans repos

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
```

---

## Precondition — bushel 11.1 (the API contract)

The app calls bushel's first `/api/*` routes (DEC-050 net-new surface). **11.1 (#261) is being
built in `bushel` separately.** Before wiring the app's data/mutation screens, verify its state:
`gh issue view 261 --repo mobiustripper42/bushel` and check for its merged PR. The scaffold +
login screen (mobile task 1) can start before 11.1 lands; the orders-list + mark-fulfilled
screens integrate against 11.1's contract, so build those after it merges (or against the
route shapes documented in #261).

Auth model (DEC-047): the app authenticates by requesting an email login code and exchanging
it for the **HMAC session as a bearer token** — the session is already bearer-consumable, so no
new auth work in bushel beyond 11.1's guard. The app stores the token and sends it on `/api/*`.

---

## Bootstrap sequence

### A. Restructure in `bushel` (do these in the bushel repo)
1. Write **DEC-052** (above) into `docs/DECISIONS.md`.
2. **Re-scope Phase 11 in `docs/PROJECT_PLAN.md`** to just 11.1: change the heading from
   "(20 pts)" to "(5 pts)", keep the 11.1 row, and remove the 11.2–11.5 rows with a note
   `→ moved to bushel-mobile Phase 1 (DEC-052)`. Also fix the velocity-table note if needed.
3. **Copy the design notes** from issues #262–#265 (their bodies are terse — see below — but
   check for comment threads) into wherever you'll recreate them, THEN close each:
   `gh issue close <N> --reason "not planned" --comment "Moved to bushel-mobile Phase 1 (DEC-052)."`
4. Commit + push these bushel changes (small PR or direct per the solo flow).

### B. Create + scaffold `bushel-mobile`
5. `gh repo create mobiustripper42/bushel-mobile --private --clone` (or create + clone).
6. `npx create-expo-app@latest .` — **you run this, not Claude**: `npx` is denied fleet-wide and this one genuinely does fetch a remote package, which is what the deny is for. TypeScript template. This gives it its own `package.json`
   (start version **0.1.0**). `git add -A && git commit && git push -u origin main`.

### C. Install the seeds workflow (make it a real seeds project)
7. Install the seeds scaffolding by hand from the **connected seeds repo**, per its
   `CLAUDE.md` § Setting Up a New Dev Project (there is no install skill — DEC-S040 retired
   both sync skills): the `CLAUDE.md` shell (verbatim — it's seeds-managed), `.claude/skills/*`,
   `.claude/agents/*`, `.claude/seeds-version`, and a `.claude/settings.local.json`.
8. **`.claude/project-type` = `webapp`** (a native app is neither `webapp` nor `tool` cleanly;
   don't invent a `mobile` type for one repo — DEC-S011. Add one only if muster also goes
   native, and it earns its keep then).
9. **Write `.claude/CLAUDE-context.md`** for the RN/Expo stack. Carry over these overrides:
   - `## Migration Protocol (project)` → **N/A** (no database).
   - `## Workflow Mechanisms` → refill the `Proof` / `Proof command` / `Surface check` slots
     with Expo's, replacing bushel's Playwright/pg/375px ones:
     EAS build + on-device verification; no migrations, no RLS, no vitest-pg. Keep test-first
     where behavior changes.
   - `## Conventions` → RN/Expo patterns (expo-router or RN navigation, secure token storage
     via expo-secure-store, `/api/*` client, expo-notifications).
   - Stack: Expo/React Native, TypeScript strict, EAS build. Backend = bushel's `/api/*`
     (bearer-auth via DEC-047 session). Reference bushel's `order.baybranchfarm.com` API base.
10. First **`/its-alive`** — it bootstraps the orphan `sessions` branch (its Step 0.6 handles
    the first-run migration path). Confirm `.sessions-worktree/` attaches.

### D. Materialize Phase 1
11. Write `docs/PROJECT_PLAN.md` in bushel-mobile with **Phase 1 = the four app tasks** (15pt),
    re-spec'd for the new repo (see source below — refine as you see fit).
12. **`/start-phase 1`** → materializes them as bushel-mobile issues #1–#4.
13. Build. Then `/kill-this` per task, `/retro` at phase close (bushel-mobile's own version line).

---

## Phase 1 task source (re-spec these — points are the prior estimates)

Recreate from the closed bushel issues; **refine scope for the native context** as you go.

| new # | from | pts | scope |
|-------|------|-----|-------|
| 1.1 | #262 | 5 | Expo scaffold + email-code login (request code → exchange for bearer, store in secure-storage) + read-only active-orders screen |
| 1.2 | #263 | 5 | **The point of the phase:** expo-notifications + Expo push API; register device token to bushel; order-arrival fan-out to Annabel. **v1 = Android-only push** (iOS remote push needs an APNs key = paid Apple Dev $99, deferred; free-signed iPhone installs but can't receive push) |
| 1.3 | #264 | 2 | Mark-fulfilled mutation — one write path through bushel's 11.1 `/api/*`; optimistic UI. Exactly one mutation (rehearsal, not an admin port) |
| 1.4 | #265 | 3 | Android EAS build → sideloaded APK for Annabel ($0, no Mac). Emma's iPhone: free-signed 7-day build, install-only — document the iOS-push-$99 gate + the 7-day re-sign reality |

Prior bodies (for reference):
- **#262:** DEC-050. Separate repo. Enter access code → store bearer token → read-only active-orders screen.
- **#263:** expo-notifications + Expo push API; device token registered to bushel; order-arrival fan-out to Annabel's Android. v1 Android-only push.
- **#264:** One write path back through 11.1; optimistic UI. Exactly one mutation, not an admin port.
- **#265:** EAS free tier Android APK; Emma iPhone free-signed 7-day install-only; document the iOS-push gate.

---

## Standing constraints (don't re-litigate)
- **Parity (DEC-050):** each bushel-mobile `/retro` runs the web↔app parity pass — which admin
  capabilities bushel shipped this window should the app pick up. The **downstream repo owns
  this** so it can't be forgotten.
- **Scope is thin (DEC-050):** receive push + read active orders + one mutation (mark-fulfilled).
  NOT an admin port. Resist scope creep into a second mutation or admin surface.
- **iOS push is gated** on the deferred $99 Apple Developer enrollment — Android proves the loop.
- **No precedent for muster** — this structure is bushel-specific; muster makes its own call.

## Key references
DEC-052 (this structure), DEC-050 (separate repo + parity + thin scope), DEC-047 (bearer session
auth), DEC-S011 (project-type), DEC-S013/S014/S022/S026 (the single-repo workflow this all rests on).
Full architect reasoning: ask the human for the Phase-11 `@architect` transcript if needed.
