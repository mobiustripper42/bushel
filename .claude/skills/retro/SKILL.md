---
name: retro
description: Phase-end retrospective. Closes out the current phase by marking PROJECT_PLAN.md tasks `[x]`, reconciling drift (issues added mid-phase), computing phase velocity, prompting for retro notes, and appending to RETROSPECTIVES.md. Optionally chains into /start-phase for the next phase.
tools: Read, Edit, Write, Bash, Glob, Grep
---

You are running the phase-end retrospective. The phase boundary is now — work for this phase is complete (or you've decided to call it done and move scope).

## Step 0 — Identify the current phase

Find phase N as the **lowest phase number with any open issues** OR (if all closed) the highest phase that has issue links in PROJECT_PLAN.md but no `[x]` marks yet.

```
for phase in 0 1 2 3 4 5 6 7 8 9; do
  open=$(gh issue list --label "phase:$phase" --state open --json number -q 'length')
  if [ "$open" -gt 0 ]; then echo "Phase $phase has $open open issues"; break; fi
done
```

Confirm with the user: "Run retro for Phase **N**?"

## Step 1 — Verify all phase issues are accounted for

```
gh issue list --label "phase:<N>" --state all --json number,title,state,labels --limit 100
```

Surface any open issues. Ask the user: "Phase N has open issues: #X, #Y. Move them to next phase, leave open, or close as won't-do? (per-issue choice or 'all to next')"

For each open issue:
- **Move to next phase:** swap the `phase:N` label for `phase:N+1`. The PROJECT_PLAN.md row's annotation will note the move at retro write.
- **Leave open:** they stay open, phase still ends. Record them in the retro notes.
- **Close as won't-do:** `gh issue close <N> --reason "not planned" --comment "Closed at Phase N retro — descoped."`

## Step 2 — Compute phase metrics

**Duration:** first issue creation timestamp → last issue close timestamp.
```
gh issue list --label "phase:<N>" --state all --json createdAt,closedAt --limit 100
```
Take min(createdAt) and max(closedAt). Subtract.

**Points:** sum of `points:X` labels on closed issues.

**Sessions touched:** glob `sessions/*.md`, count those whose `started:` falls within the phase window.

**Velocity:** `total_hours_worked / total_points_completed`.

For total hours worked: sum `duration:` from session files in the phase window. (Sessions span phases sometimes; that's OK — count any session whose work touched a phase issue.)

## Step 3 — Update PROJECT_PLAN.md

Mark all closed phase tasks `[x]`. For each row:
```
| 1.1 | Task description | 3 | [x] [#42](url) |
```

**Reconcile drift:** check for issues with `phase:<N>` labels that don't appear in the PROJECT_PLAN.md phase table (added mid-phase). For each:
- Add a row to the phase, with status `[x] [#N](url)` and an inline annotation: `Added during P<N> retro — emerged from #X` or similar context.

**Update the velocity table** at the top of PROJECT_PLAN.md:
```
| Sessions | Points completed | Hours | Hours/point |
|---|---|---|---|
| <count for phase N> | <points> | <hours> | <hrs/pt> |
```

Append a row per phase as they complete.

## Step 4 — Prompt retro notes

Ask the user three questions, one at a time:

1. **What worked?** (kept practices)
2. **What didn't?** (friction, surprises, scope creep)
3. **What changes for next phase?** (specific, actionable)

Capture verbatim — do not summarize or rewrite.

## Step 5 — Append to RETROSPECTIVES.md

If `docs/RETROSPECTIVES.md` doesn't exist, create it with a header. Append:

```
## Phase <N> — <YYYY-MM-DD>

**Duration:** <hours>h across <session count> sessions
**Points completed:** <P> / <P_planned> (<%>)
**Velocity:** <hrs/pt>
**Issues:** <count> created, <closed_count> closed, <open_count> moved to Phase <N+1>

### What worked
- <verbatim from user>

### What didn't
- <verbatim>

### Changes for next phase
- <verbatim>

### Scope changes
- [List any tasks added mid-phase, moved out, or descoped]
```

## Step 6 — Commit and push

```
git add docs/PROJECT_PLAN.md docs/RETROSPECTIVES.md
git commit -m "Phase <N> retro — <points> pts, <hours>h, <hrs/pt> hrs/pt"
git push origin <BRANCH>
```

## Step 6.5 — Minor version bump (dev projects only)

Run only if `package.json` exists at the repo root (dev-project signal — DEC-007). Otherwise: skip silently.

Resolve the working branch — phase boundaries land on `staging` if it exists, `main` otherwise:
```
git show-ref --verify --quiet refs/remotes/origin/staging && WORKING_BRANCH=staging || WORKING_BRANCH=main
```

If `BRANCH != $WORKING_BRANCH`: STOP. Phase retros must run on the working branch (otherwise the bump lands on a feature branch and gets orphaned). Tell the user: "Switch to `$WORKING_BRANCH` and re-run /retro." Wait.

a. **Bump minor:**
   ```
   NEW_VERSION=$(npm version minor --no-git-tag-version | tr -d 'v')
   ```
   `npm version minor` zeros the patch automatically (e.g. `1.2.7 → 1.3.0`).

b. **Append CHANGELOG entry.** If `CHANGELOG.md` doesn't exist, create with `# Changelog\n\n`. If it exists but doesn't start with the literal `# Changelog\n` header (e.g. setext form, `# CHANGELOG`, or notes above the header), STOP and surface to the user — do not guess where to insert. Otherwise prepend after the `# Changelog` header:
   ```
   ## [<NEW_VERSION>] - <YYYY-MM-DD> — Phase <N>
   - <points> pts shipped across <session count> sessions (<hrs/pt> hrs/pt)
   - See `docs/RETROSPECTIVES.md` for the full retro
   ```

c. **Commit:**
   ```
   git add package.json CHANGELOG.md
   [ -f package-lock.json ] && git add package-lock.json
   git commit -m "Phase <N> close — bump version to v$NEW_VERSION"
   ```

d. **Tag (main only):** if `$WORKING_BRANCH = main`, also `git tag "v$NEW_VERSION"`. On staging, the tag waits for `/promote-staging`.

e. **Push:**
   ```
   git push origin "$WORKING_BRANCH"
   ```
   If a tag was created: `git push origin "v$NEW_VERSION"`.

f. **Echo:** `Phase <N> closed at v<NEW_VERSION>` (and `tagged` if main).

## Step 7 — Offer to start next phase

Ask: "Phase <N+1> is next. Run `/start-phase <N+1>` now or stop here?"

If the user says yes, hand off — do not invoke directly, let them invoke the skill so the framing of a fresh skill execution is preserved.

## Step 8 — Summary

```
Phase <N> closed.
Points: <P> in <hours>h → <hrs/pt> hrs/pt
Issues: <closed>/<created> closed; <moved> moved to Phase <N+1>
Retro: docs/RETROSPECTIVES.md
Version: v<NEW_VERSION> (dev projects only; skipped if no package.json)
```
