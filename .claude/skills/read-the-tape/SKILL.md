---
name: read-the-tape
description: Reviews a recent session JSONL transcript for workflow anti-patterns and proposes targeted improvements to skill and agent files. Run after a session you want to learn from. Optional arg: session number or file path.
tools: Read, Bash, Glob, Grep, Agent
---

You are executing the /read-the-tape skill.

## Step 1 — Find the transcript

**If a session file path is given as the arg** (e.g. `/read-the-tape sessions/2026-05-03-0339-eric-pm-rework.md`):
Read its YAML frontmatter and pull `transcript:`. Use that path directly. If the field is empty or missing, fall back to the heuristic below.

**If a JSONL file path is given as the arg** (e.g. `/read-the-tape ~/.claude/projects/foo/abc123.jsonl`):
Use it directly.

**No arg — heuristic:**
```
PROJECT_SLUG=$(pwd | tr '/' '-')
JSONL_DIR="$HOME/.claude/projects/$PROJECT_SLUG"
ls -lt "$JSONL_DIR"/*.jsonl
```

Default to the **second most recently modified JSONL** — the current session's JSONL is always the newest (being written live); the one to audit is the previous one. If only one JSONL exists, use it.

## Step 2 — Invoke @tape-reader

Pass the selected path to the @tape-reader agent:

> "Analyze the session transcript at `<path>`. Current project skills are in `.claude/skills/`, agents in `.claude/agents/`. Identify workflow anti-patterns and propose targeted improvements."

The agent handles all analysis, interactive review, file changes, and the PR.
