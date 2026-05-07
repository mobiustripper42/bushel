// Admin · Settings — schedule + pickup windows + sticky save

function SettingsPage() {
  const { useState, useMemo } = React;

  // ordering schedule
  const [openDay,  setOpenDay]  = useState("Saturday");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeDay, setCloseDay] = useState("Tuesday");
  const [closeTime, setCloseTime] = useState("21:00");
  const [useSchedule, setUseSchedule] = useState(true);
  const [manualState, setManualState] = useState("auto"); // auto | open | closed

  // pickup windows
  const [windows, setWindows] = useState([
    { id: 1, label: "Saturday at the farm", day: "Saturday", start: "09:00", end: "12:00", active: true  },
    { id: 2, label: "Wednesday Tremont drop-off", day: "Wednesday", start: "16:00", end: "18:30", active: true  },
    { id: 3, label: "Lakewood Farmer's Market", day: "Saturday",  start: "10:00", end: "14:00", active: true  },
    { id: 4, label: "Friday onsite (special)",   day: "Friday",   start: "14:00", end: "17:00", active: false },
  ]);
  const [draggingId, setDraggingId] = useState(null);

  const [hasChanges, setHasChanges] = useState(true);

  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const stateInfo = useMemo(() => {
    if (!useSchedule || manualState === "closed") {
      return {
        kind: "closed",
        title: "Ordering is closed",
        sub: useSchedule ? "Manual override is active." : "Weekly schedule is off — toggle ordering by hand."
      };
    }
    if (manualState === "open") {
      return {
        kind: "paused",
        title: "Ordering is open (manual)",
        sub: "Manual override active — schedule will resume next cycle."
      };
    }
    return {
      kind: "open",
      title: `Ordering is OPEN until ${closeDay} ${formatTime(closeTime)}`,
      sub: `Auto-opens ${openDay} ${formatTime(openTime)} every week.`
    };
  }, [useSchedule, manualState, openDay, openTime, closeDay, closeTime]);

  function formatTime(t) {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h % 12 || 12;
    return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2,"0")}${ampm}`;
  }

  function updateWindow(id, patch) {
    setWindows(ws => ws.map(w => w.id === id ? { ...w, ...patch } : w));
    setHasChanges(true);
  }
  function removeWindow(id) {
    setWindows(ws => ws.filter(w => w.id !== id));
    setHasChanges(true);
  }
  function addWindow() {
    const newId = Math.max(0, ...windows.map(w => w.id)) + 1;
    setWindows(ws => [...ws, { id: newId, label: "New window", day: "Saturday", start: "09:00", end: "12:00", active: true }]);
    setHasChanges(true);
  }

  // drag reorder
  function onDragStart(id) { setDraggingId(id); }
  function onDragOver(e, overId) {
    e.preventDefault();
    if (draggingId == null || draggingId === overId) return;
    setWindows(ws => {
      const from = ws.findIndex(w => w.id === draggingId);
      const to = ws.findIndex(w => w.id === overId);
      if (from < 0 || to < 0) return ws;
      const next = ws.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }
  function onDragEnd() { setDraggingId(null); setHasChanges(true); }

  return (
    <div>
      <div className="set-head">
        <div className="eyebrow">Configuration</div>
        <div className="set-title">Settings</div>
        <div className="set-subtitle">
          The rhythm of the week — when ordering opens, when it closes, where customers pick up.
        </div>
      </div>

      <div className="set-cards">
        {/* CARD 1 — Ordering schedule */}
        <section className="set-card">
          <header className="set-card-head">
            <div className="set-card-head-l">
              <div className="set-card-eyebrow">01 · Cadence</div>
              <div className="set-card-title">Ordering schedule</div>
              <div className="set-card-desc">
                The order form auto-opens and closes on this weekly schedule. Override below if you need to break the rhythm — for a holiday week, say.
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
                <select className="set-control is-day" value={openDay} onChange={e => { setOpenDay(e.target.value); setHasChanges(true); }} disabled={!useSchedule}>
                  {days.map(d => <option key={d}>{d}</option>)}
                </select>
                <span className="set-conjunction">at</span>
                <input type="time" className="set-control is-time" value={openTime} onChange={e => { setOpenTime(e.target.value); setHasChanges(true); }} disabled={!useSchedule} />
              </div>
            </div>

            <div className="set-row">
              <div className="set-row-key">
                Default close
                <small>When the order form locks. Customers see a "closed" state after this.</small>
              </div>
              <div className="set-row-val">
                <select className="set-control is-day" value={closeDay} onChange={e => { setCloseDay(e.target.value); setHasChanges(true); }} disabled={!useSchedule}>
                  {days.map(d => <option key={d}>{d}</option>)}
                </select>
                <span className="set-conjunction">at</span>
                <input type="time" className="set-control is-time" value={closeTime} onChange={e => { setCloseTime(e.target.value); setHasChanges(true); }} disabled={!useSchedule} />
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
                  onClick={() => { setUseSchedule(v => !v); setHasChanges(true); }}
                />
                <span style={{ fontSize: "0.88rem", color: "var(--ink-500)" }}>
                  {useSchedule ? "Schedule is on" : "Manual mode"}
                </span>
              </div>
            </div>

            <div className={"set-state-block " + (stateInfo.kind === "closed" ? "is-closed" : stateInfo.kind === "paused" ? "is-paused" : "")}>
              <div className="set-state-l">
                <span className="set-state-pulse" />
                <div>
                  <div className="set-state-text">
                    <strong>{stateInfo.title}</strong>
                  </div>
                  <span className="set-state-sub">{stateInfo.sub}</span>
                </div>
              </div>
              <div className="set-state-actions">
                {manualState !== "open" && stateInfo.kind !== "open" && (
                  <button type="button" className="set-override-btn is-primary" onClick={() => { setManualState("open"); setHasChanges(true); }}>
                    Open now
                  </button>
                )}
                {stateInfo.kind === "open" && (
                  <button type="button" className="set-override-btn is-warn" onClick={() => { setManualState("closed"); setHasChanges(true); }}>
                    Close now
                  </button>
                )}
                {manualState !== "auto" && (
                  <button type="button" className="set-override-btn" onClick={() => { setManualState("auto"); setHasChanges(true); }}>
                    Resume schedule
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CARD 2 — Pickup windows */}
        <section className="set-card">
          <header className="set-card-head">
            <div className="set-card-head-l">
              <div className="set-card-eyebrow">02 · Where & when</div>
              <div className="set-card-title">Pickup windows</div>
              <div className="set-card-desc">
                The fulfillment options customers see at checkout. Drag to reorder — the top of the list is the default. Inactive windows stay configured but are hidden from the form.
              </div>
            </div>
          </header>

          <div className="set-card-body">
            <div className="pw-row-headers">
              <span></span>
              <span>Label</span>
              <span>Day</span>
              <span>Time window</span>
              <span className="pw-h-active">Active</span>
              <span></span>
            </div>

            <div className="pw-list">
              {windows.map((w, i) => (
                <div
                  key={w.id}
                  className={
                    "pw-row" +
                    (draggingId === w.id ? " is-dragging" : "") +
                    (w.active ? "" : " is-inactive")
                  }
                  draggable
                  onDragStart={() => onDragStart(w.id)}
                  onDragOver={(e) => onDragOver(e, w.id)}
                  onDragEnd={onDragEnd}
                >
                  <span className="pw-handle" title="Drag to reorder">
                    <svg viewBox="0 0 24 24" width="14" height="20" fill="currentColor">
                      <circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/>
                      <circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/>
                      <circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>
                    </svg>
                  </span>

                  <div className="pw-row-label">
                    <span className="pw-row-num">{String(i + 1).padStart(2, "0")}</span>
                    <input
                      className="set-control is-label"
                      value={w.label}
                      onChange={(e) => updateWindow(w.id, { label: e.target.value })}
                    />
                  </div>

                  <select
                    className="set-control is-day"
                    value={w.day}
                    onChange={(e) => updateWindow(w.id, { day: e.target.value })}
                  >
                    {days.map(d => <option key={d}>{d}</option>)}
                  </select>

                  <div className="pw-time-pair">
                    <input
                      type="time" className="set-control is-time"
                      value={w.start}
                      onChange={(e) => updateWindow(w.id, { start: e.target.value })}
                    />
                    <span style={{ color: "var(--ink-500)", fontFamily: "var(--mono)", fontSize: "0.78rem" }}>→</span>
                    <input
                      type="time" className="set-control is-time"
                      value={w.end}
                      onChange={(e) => updateWindow(w.id, { end: e.target.value })}
                    />
                  </div>

                  <div className="pw-active-cell">
                    <button
                      type="button"
                      className={"toggle is-sm" + (w.active ? " is-on" : "")}
                      aria-pressed={w.active}
                      onClick={() => updateWindow(w.id, { active: !w.active })}
                    />
                  </div>

                  <button
                    type="button"
                    className="pw-row-remove"
                    title="Remove window"
                    onClick={() => removeWindow(w.id)}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/>
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="pw-add" onClick={addWindow}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14"/><path d="M5 12h14"/>
              </svg>
              Add window
            </button>

            <div className="pw-summary">
              <strong>{windows.filter(w => w.active).length}</strong> of {windows.length} windows active.
              Customers at checkout will see the active ones in this order.
            </div>
          </div>
        </section>
      </div>

      <div className={"set-savebar" + (hasChanges ? " has-changes" : "")}>
        <div className="set-savebar-l">
          <span className="set-savebar-dot" />
          {hasChanges
            ? "Unsaved changes — settings won't apply until you save."
            : "All changes saved · last updated Apr 28, 2:14pm"}
        </div>
        <div className="set-savebar-r">
          <button
            type="button"
            className="set-savebar-btn is-cancel"
            disabled={!hasChanges}
            onClick={() => setHasChanges(false)}
          >
            Discard
          </button>
          <button
            type="button"
            className="set-savebar-btn is-save"
            disabled={!hasChanges}
            onClick={() => setHasChanges(false)}
          >
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
