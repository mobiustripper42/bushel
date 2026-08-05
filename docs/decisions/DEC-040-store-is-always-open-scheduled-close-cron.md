---
id: DEC-040
title: "Store is always-open; scheduled-close cron disabled (amends DEC-030)"
topic: "Store hours & availability"
amends:
  - id: DEC-030
    relation: amends
    scope: "the scheduled-close cron is disabled; always-open stands"
---

## DEC-040: Store is always-open; scheduled-close cron disabled (amends DEC-030)

**Decision:** `ordering_schedule.is_open` is operated **only** by the manual `toggleOrdering` button. The scheduled-close cron is **disabled** — the `crons` entry is removed from `vercel.json` so `/api/cron/check-schedule` never fires. The machinery (`save-schedule.ts`, the cron route, `SettingsScheduleCard`, and the `weekly_*` / `override_closes_at` columns) is **left in place, dormant** — removable anytime.

**Why:** The farm wants continuous open, closed only by deliberate action. The cron is the *only* schedule-driven writer of `is_open` (the order page treats `is_open` as a soft UI hint; `toggle-ordering.ts` is the only other writer), so disabling it makes open/closed a manual-only decision and neutralizes the cron's UTC `getDay()`/`getHours()` timezone-edge bugs — without ripping out code.

**Revised from the planning memo:** the original DEC-040 proposed *deleting* the machinery + dropping 5 schedule columns. Softened to disable-the-cron — it's built and harmless, removal can happen later. Saves a migration.

**Accepted limitation:** `SettingsScheduleCard` stays settable but inert (no cron acts on a set schedule). Harmless; hiding it is deferred to whenever the machinery is fully removed.

**Supersedes (DEC-030):** "scheduled close opt-in" — there is no scheduled close now, only the manual toggle.

---
