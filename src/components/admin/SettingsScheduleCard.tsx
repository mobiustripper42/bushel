"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSchedule } from "@/actions/save-schedule";
import { toggleOrdering, type ToggleOrderingAction } from "@/actions/toggle-ordering";
import { DAYS, formatTime } from "@/lib/schedule-format";

type ScheduleRow = {
  is_open: boolean;
  weekly_open_day: number | null;
  weekly_open_time: string | null;
  weekly_close_day: number | null;
  weekly_close_time: string | null;
};

// DORMANT (DEC-040): the schedule this card edits is inert — the cron that
// acted on it no longer fires (vercel.json crons entry removed). The manual
// open/close toggle here is the only live control.
export function SettingsScheduleCard({ schedule }: { schedule: ScheduleRow }) {
  const hasWeekly =
    schedule.weekly_open_day != null &&
    schedule.weekly_open_time != null &&
    schedule.weekly_close_day != null &&
    schedule.weekly_close_time != null;

  const [isOpen, setIsOpen] = useState(schedule.is_open);
  const [useSchedule, setUseSchedule] = useState(hasWeekly);
  const [openDay, setOpenDay] = useState(schedule.weekly_open_day ?? 0);
  const [openTime, setOpenTime] = useState(schedule.weekly_open_time ?? "08:00");
  const [closeDay, setCloseDay] = useState(schedule.weekly_close_day ?? 2);
  const [closeTime, setCloseTime] = useState(schedule.weekly_close_time ?? "21:00");
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isToggling, startToggle] = useTransition();
  const router = useRouter();

  const stateInfo = useMemo(() => {
    if (!isOpen) {
      return {
        kind: "closed" as const,
        title: "Ordering is closed",
        sub: useSchedule
          ? "Manual override active. Click 'Open now' or wait for the schedule to open."
          : "Toggle ordering by hand using the buttons below.",
      };
    }
    if (!useSchedule) {
      return {
        kind: "paused" as const,
        title: "Ordering is open (manual)",
        sub: "No weekly schedule — close manually when ready.",
      };
    }
    return {
      kind: "open" as const,
      title: `Ordering is OPEN until ${DAYS[closeDay]} ${formatTime(closeTime)}`,
      sub: `Auto-opens ${DAYS[openDay]} ${formatTime(openTime)} every week.`,
    };
  }, [isOpen, useSchedule, openDay, openTime, closeDay, closeTime]);

  const markDirty = useCallback(() => setHasChanges(true), []);

  function handleToggle(action: ToggleOrderingAction) {
    startToggle(async () => {
      const err = await toggleOrdering(action);
      if (!err) {
        if (action === "open") setIsOpen(true);
        else if (action === "close") setIsOpen(false);
        router.refresh();
      }
    });
  }

  function handleSave() {
    startSave(async () => {
      const err = await saveSchedule({ useSchedule, openDay, openTime, closeDay, closeTime });
      if (err) {
        setSaveError(err);
      } else {
        setSaveError(null);
        setHasChanges(false);
      }
    });
  }

  function handleDiscard() {
    setUseSchedule(hasWeekly);
    setOpenDay(schedule.weekly_open_day ?? 0);
    setOpenTime(schedule.weekly_open_time ?? "08:00");
    setCloseDay(schedule.weekly_close_day ?? 2);
    setCloseTime(schedule.weekly_close_time ?? "21:00");
    setHasChanges(false);
    setSaveError(null);
  }

  return (
    <>
      <section className="set-card">
        <header className="set-card-head">
          <div className="set-card-head-l">
            <div className="set-card-eyebrow">01 · Cadence</div>
            <div className="set-card-title">Ordering schedule</div>
            <div className="set-card-desc">
              The order form auto-opens and closes on this weekly schedule. Override below if you
              need to break the rhythm — for a holiday week, say.
            </div>
          </div>
        </header>

        <div className="set-card-body">
          <div className="set-row">
            <div className="set-row-key">
              Default open
              <small>When the order form goes live each week.</small>
            </div>
            <div className="set-row-val">
              <select
                className="set-control is-day"
                value={openDay}
                disabled={!useSchedule}
                onChange={(e) => { setOpenDay(Number(e.target.value)); markDirty(); }}
              >
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
              <span className="set-conjunction">at</span>
              <input
                type="time"
                className="set-control is-time"
                value={openTime}
                disabled={!useSchedule}
                onChange={(e) => { setOpenTime(e.target.value); markDirty(); }}
              />
            </div>
          </div>

          <div className="set-row">
            <div className="set-row-key">
              Default close
              <small>When the order form locks. Customers see a &ldquo;closed&rdquo; state after this.</small>
            </div>
            <div className="set-row-val">
              <select
                className="set-control is-day"
                value={closeDay}
                disabled={!useSchedule}
                onChange={(e) => { setCloseDay(Number(e.target.value)); markDirty(); }}
              >
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
              <span className="set-conjunction">at</span>
              <input
                type="time"
                className="set-control is-time"
                value={closeTime}
                disabled={!useSchedule}
                onChange={(e) => { setCloseTime(e.target.value); markDirty(); }}
              />
            </div>
          </div>

          <div className="set-row">
            <div className="set-row-key">
              Use weekly schedule
              <small>Off means ordering is purely manual — open and close it yourself.</small>
            </div>
            <div className="set-row-val">
              <button
                type="button"
                className={"toggle" + (useSchedule ? " is-on" : "")}
                aria-pressed={useSchedule}
                aria-label={useSchedule ? "Disable weekly schedule" : "Enable weekly schedule"}
                onClick={() => { setUseSchedule((v) => !v); markDirty(); }}
              />
              <span style={{ fontSize: "0.88rem", color: "var(--ink-500)" }}>
                {useSchedule ? "Schedule is on" : "Manual mode"}
              </span>
            </div>
          </div>

          <div className={"set-state-block" + (stateInfo.kind === "closed" ? " is-closed" : stateInfo.kind === "paused" ? " is-paused" : "")}>
            <div className="set-state-l">
              <span className="set-state-pulse" aria-hidden="true" />
              <div>
                <div className="set-state-text">
                  <strong>{stateInfo.title}</strong>
                </div>
                <span className="set-state-sub">{stateInfo.sub}</span>
              </div>
            </div>
            <div className="set-state-actions">
              {!isOpen && (
                <button
                  type="button"
                  className="set-override-btn is-primary"
                  disabled={isToggling}
                  onClick={() => handleToggle("open")}
                >
                  Open now
                </button>
              )}
              {isOpen && (
                <button
                  type="button"
                  className="set-override-btn is-warn"
                  disabled={isToggling}
                  onClick={() => handleToggle("close")}
                >
                  Close now
                </button>
              )}
              {useSchedule && (
                <button
                  type="button"
                  className="set-override-btn"
                  disabled={isToggling}
                  onClick={() => handleToggle("resume")}
                >
                  Resume schedule
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className={"set-savebar" + (hasChanges ? " has-changes" : "")}>
        <div className="set-savebar-l">
          <span className="set-savebar-dot" aria-hidden="true" />
          {saveError
            ? <span style={{ color: "#b23b2e" }}>{saveError}</span>
            : "Unsaved changes — settings won't apply until you save."}
        </div>
        <div className="set-savebar-r">
          <button
            type="button"
            className="set-savebar-btn is-cancel"
            disabled={!hasChanges || isSaving}
            onClick={handleDiscard}
          >
            Discard
          </button>
          <button
            type="button"
            className="set-savebar-btn is-save"
            disabled={!hasChanges || isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </>
  );
}
