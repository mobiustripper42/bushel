---
name: its-dead
description: Second half of the end-of-session shutdown. Calculates duration, fills in points, finalizes the per-session file (or legacy session-log.md entry), commits the log, and cleans up branches. Run after /kill-this once the draft looks good. Optional args: natural-language time adjustments, e.g. "/its-dead subtract 30 minutes for time away from desk".
tools: Read, Edit, Write, Bash, Glob, Grep, Agent
---

You are executing the second half of the end-of-session shutdown. The user has reviewed and approved the session log draft from /kill-this.

## Step 0 — Locate the open session

**Try new format first:**
```
SESSION_FILE=$(grep -l "^status: open" sessions/*.md 2>/dev/null | head -1)
```

If found: NEW MODE. Skip to Step 1.

**Otherwise legacy:** look for `[open]` in `session-log.md`:
```
grep -n "\[open\]" session-log.md
```

If found: LEGACY MODE. Note this and proceed; all writes go to `session-log.md` (NOT to a new sessions/ file). The PROJECT_PLAN.md `[x]` updates also still happen (legacy /its-dead behavior).

If neither: stop and ask the user how to proceed.

## Step 1 — Calculate duration

**End time:** `END_UTC=$(git log -1 --format="%cI")` (most recent commit ISO 8601 timestamp).

**Start time:**
- NEW MODE: parse `started:` from the session file's YAML frontmatter.
- LEGACY MODE: parse the timestamp from the `## Session N — YYYY-MM-DD HH:MM [open]` heading.

Compute `END_UTC - START_UTC` in hours, rounded to nearest 5 minutes (0.083 hr). Apply any time adjustment from skill args (e.g. "subtract 30 minutes" → reduce by 0.5 hr). If you cannot confidently determine duration, ask the user.

## Step 2 — Tally points

Two sources, in priority order:

**a) Issues closed this session (preferred for phase-rituals projects):**
```
gh pr list --author @me --state merged --search "merged:>$START_DATE" --json number,closingIssuesReferences --limit 20
```
For each PR's closing issues, sum the `points:N` label values. (Skip silently if `gh` unavailable or no Issues are in use.)

**b) PROJECT_PLAN.md task rows (legacy / pre-Phase-rituals projects):**
For each task completed this session, grep its row from `docs/PROJECT_PLAN.md` to read its effort: `grep "| <taskID> " docs/PROJECT_PLAN.md`. Sum.

Use whichever produced a number. If both are empty, mark `points: 0` with a note.

## Step 3 — Finalize the session file

**NEW MODE:** edit the session file:
1. Update frontmatter:
   - `ended: <END_UTC>`
   - `duration: <hours>` (e.g. `2.5`)
   - `points: <sum>`
   - `status: closed`
2. Replace the body sections with the approved /kill-this draft (Task, Completed, In Progress, Blocked, Next Steps, Context, Code Review).

**LEGACY MODE:** replace the open entry in `session-log.md` with the approved draft using the existing format:
```
## Session N — YYYY-MM-DD HH:MM–HH:MM (Xh Ym)
**Duration:** Xh Ym | **Points:** N
...
```

## Step 4 — Update PROJECT_PLAN.md (legacy only)

**NEW MODE / phase-rituals projects:** **DO NOT** edit PROJECT_PLAN.md. Phase-boundary-only writes — task `[x]` marking happens at `/retro`. The Issue close (via PR's `closes #N`) is the source of truth during the phase.

**LEGACY MODE:** mark any tasks completed this session with `[x]` and append `<!-- completed YYYY-MM-DD -->`.

## Step 5 — Branch cleanup + final push

**Worktree check first:** `git rev-parse --git-dir`. If output contains `/worktrees/`, take the worktree path; do NOT `git checkout main` or FF-merge.

**Worktree path:**
1. `BRANCH=$(git branch --show-current)`, `WORKTREE_PATH=$(git rev-parse --show-toplevel)`.
2. `gh pr view $BRANCH --json state -q '.state' 2>/dev/null` to check PR state.
3. **OPEN:** `git add` (the session file or session-log.md, plus PROJECT_PLAN.md if legacy) + commit + `git push origin $BRANCH`. Remind user to review/merge. Stop here — worktree stays until merged.
4. **MERGED:** same commit + push (log travels with branch). Tell user: "Worktree cleanup — from main repo: `git worktree remove $WORKTREE_PATH`"
5. **CLOSED:** STOP. Ask: "PR was closed without merging — discard this worktree or keep for archeology?" Wait.
6. **No PR:** commit + push, remind user to open a PR.

**Normal path:** `BRANCH=$(git branch --show-current)`.

**Files to add** depend on mode:
- NEW MODE: `git add "$SESSION_FILE"`
- LEGACY MODE: `git add session-log.md docs/PROJECT_PLAN.md`

**On `main`:** commit + `git push origin main`. Done.

**On non-main branch — PR-state check:**
```
gh pr view $BRANCH --json state -q '.state' 2>/dev/null
```

- **OPEN:** PR is the merge gate. Commit + push to the task branch so the log lands in the PR. Surface the PR URL. Do NOT FF-merge or delete the branch. Stop.
- **MERGED:** commit the log directly to main (NOT the task branch — that requires cherry-pick).
  ```
  git checkout main
  git pull --ff-only origin main
  git add <files>
  git commit -m "Update session log for session N"
  git push origin main
  git branch -d $BRANCH
  git push origin --delete $BRANCH   # no-op if GitHub already deleted on merge
  ```
  If `git branch -d` fails: tell the user, provide `git branch -D` for them to run manually.
- **CLOSED:** STOP. Ask: "PR was closed without merging — discard this branch or keep?" Wait.
- **No PR:** legacy DEC-005 cleanup (orphan auto-branches like `claude/<slug>`):
  a. Commit on the current branch.
  b. `git checkout main` (or `git checkout -b main origin/main` if no local main yet). `git pull --ff-only origin main`.
  c. `git merge --ff-only $BRANCH`. If can't FF, surface and ask.
  d. `git branch -d $BRANCH` (lowercase, safe). If fails: surface, do not retry with `-D`.
  e. `git push origin --delete $BRANCH`. Capture success/failure.
  f. If remote delete failed: append `**Orphan branch:** \`$BRANCH\` could not be deleted on origin (best-effort failure). Manual cleanup via GitHub UI required.` to the session file's Context section. Amend the commit.
  g. `git push origin main`.

## Step 6 — Closing summary

Print a one-line summary:
```
Session <N> closed. Duration: <hours>h. Points: <N>. File: <path>.
```

If on a PR-flow project and the phase rituals are in use, also say: "Phase progress: see `gh issue list --label phase:current --state open` — close out remaining issues, then `/retro` at phase boundary."
