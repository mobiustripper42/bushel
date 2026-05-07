// Admin · Send Update — split view (form / phone preview)

function SendPage() {
  const { useState, useMemo } = React;

  const defaultIntro =
    "Heirloom tomatoes are exceptional this week — sungolds, brandywines, and a small batch of green zebras. Pickup Saturday at the farm or Wednesday in Tremont.";

  const [weekLabel, setWeekLabel] = useState("Week of May 3");
  const [intro, setIntro] = useState(defaultIntro);
  const [windowOpen, setWindowOpen] = useState(true);
  const [hours, setHours] = useState(4);

  const subscribers = 7;

  // sms teaser is what shows at the top of the message — short.
  const teaser =
    "Bay Branch Farm — this week: tomatoes, zinnias, basil + more. Order before Friday 6pm.";
  const linkLine = "bushel.farm/c/d4f2";

  const introForSms = intro.trim();

  const smsBody = introForSms
    ? `${teaser}\n\n${introForSms}\n\n${linkLine}`
    : `${teaser}\n\n${linkLine}`;

  const charCount = smsBody.length;
  const segments = Math.max(1, Math.ceil(charCount / 160));
  const segPct = Math.min(100, (charCount / (segments * 160)) * 100);

  const history = [
    { date: "Apr 26", weekLabel: "Week of Apr 26", count: 7, opens: 6, orders: 5 },
    { date: "Apr 19", weekLabel: "Week of Apr 19", count: 6, opens: 5, orders: 4 },
    { date: "Apr 12", weekLabel: "Week of Apr 12", count: 6, opens: 6, orders: 5 },
    { date: "Apr 5",  weekLabel: "Week of Apr 5",  count: 5, opens: 4, orders: 3 },
  ];

  return (
    <div>
      <div className="send-head">
        <div className="eyebrow">Weekly broadcast</div>
        <div className="send-title">Send the inventory update</div>
        <div className="send-subtitle">
          One message goes to every subscribed customer — Saturday morning is the usual cadence.
        </div>
      </div>

      <div className="send-page">
        {/* ---------------- LEFT: form ---------------- */}
        <div className="send-form">
          <div className="send-card">
            <div className="send-field">
              <label className="send-label">
                Week label
                <span className="send-label-hint">auto-filled — edit if you want</span>
              </label>
              <input
                className="send-input"
                value={weekLabel}
                onChange={(e) => setWeekLabel(e.target.value)}
              />
            </div>

            <div className="send-field">
              <label className="send-label">
                Intro note
                <span className="send-label-hint">optional · plain text</span>
              </label>
              <textarea
                className="send-textarea"
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder="A line or two from you. What's good this week, what to ask about."
              />
              <div className="send-charcount">
                <span>{intro.length} characters in note</span>
                <span>Renders as the second paragraph in the SMS</span>
              </div>
            </div>
          </div>

          <div className="send-recipients">
            <div className="send-recipients-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="send-recipients-body">
              <div className="send-recipients-num">{subscribers}</div>
              <div className="send-recipients-label">subscribers will receive this message</div>
            </div>
            <button type="button" className="send-recipients-link">Manage list</button>
          </div>

          <div className="send-action">
            <button type="button" className="send-button">
              <span className="send-button-main">
                <span>Send to all subscribers</span>
                <span className="send-button-sub">{subscribers} recipients · est. delivery in under a minute</span>
              </span>
              <span className="send-button-arrow">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/>
                  <path d="m13 5 7 7-7 7"/>
                </svg>
              </span>
            </button>
            <div className="send-confirm-note">
              You'll get a <strong>final confirmation</strong> before anything is sent.
            </div>
          </div>

          <div>
            <div className="send-history-head">
              <span className="send-history-title">Past sends</span>
              <a href="#" className="send-history-link">View all</a>
            </div>
            <ul className="send-history-list">
              {history.map((h) => (
                <li key={h.date} className="send-history-row">
                  <span className="send-history-dot" />
                  <span>
                    <div className="send-history-date">{h.weekLabel}</div>
                    <div className="send-history-meta" style={{ fontFamily: "var(--sans)", color: "var(--ink-500)" }}>
                      Sent {h.date} · {h.opens}/{h.count} opened · {h.orders} orders
                    </div>
                  </span>
                  <span className="send-history-meta">{h.count} sent</span>
                  <button type="button" className="send-history-action">Duplicate</button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ---------------- RIGHT: preview ---------------- */}
        <div className="send-preview-col">
          <div className="send-preview-head">
            <span className="send-preview-eyebrow">Live preview · what customers will see</span>
            <span className="send-preview-live">
              <span className="pulse" />
              live
            </span>
          </div>

          <div>
            <div className="phone-stage">
              <Phone smsBody={smsBody} weekLabel={weekLabel} />
            </div>

            <div className="sms-meta">
              <span><strong>{charCount}</strong> chars</span>
              <span>
                <span className="sms-meta-bar"><i style={{ width: segPct + "%" }} /></span>
                {segments} {segments === 1 ? "segment" : "segments"} ({segments * 160} char limit)
              </span>
              <span>~ <strong>${(segments * subscribers * 0.0079).toFixed(2)}</strong> est.</span>
            </div>
          </div>

          <div className="send-window">
            <div className="send-window-row">
              <div className="send-window-label">
                Open ordering for the week
                <span className="send-window-sub">
                  Customers can submit orders only while this is on.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className={"send-status-pill " + (windowOpen ? "" : "is-closed")}>
                  <span className="dot" />
                  {windowOpen ? "Open" : "Closed"}
                </span>
                <button
                  type="button"
                  className={"toggle" + (windowOpen ? " is-on" : "")}
                  aria-pressed={windowOpen}
                  onClick={() => setWindowOpen(v => !v)}
                />
              </div>
            </div>

            <div className="send-window-row">
              <div className="send-window-label">
                Open for
                <span className="send-window-sub">
                  Quick close — auto-locks the order form after this many hours.
                </span>
              </div>
              <div className="hour-stepper" aria-label="Hours open">
                <button type="button" disabled={hours <= 1} onClick={() => setHours(h => Math.max(1, h - 1))}>−</button>
                <div className="hour-stepper-val">
                  {hours}<small>hr</small>
                </div>
                <button type="button" disabled={hours >= 72} onClick={() => setHours(h => Math.min(72, h + 1))}>+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Phone({ smsBody, weekLabel }) {
  return (
    <div className="phone">
      <div className="phone-screen">
        <div className="phone-notch" />
        <div className="phone-status">
          <span>9:41</span>
          <span className="phone-status-icons">
            <svg viewBox="0 0 18 12" width="18" height="12" fill="currentColor"><rect x="0" y="6" width="3" height="6" rx="0.5"/><rect x="5" y="3" width="3" height="9" rx="0.5"/><rect x="10" y="0" width="3" height="12" rx="0.5"/></svg>
            <svg viewBox="0 0 16 12" width="16" height="12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 5a10 10 0 0 1 14 0"/><path d="M3 7.5a7 7 0 0 1 10 0"/><path d="M5 10a4 4 0 0 1 6 0"/></svg>
            <svg viewBox="0 0 24 12" width="24" height="12" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="1.5" width="20" height="9" rx="2"/><rect x="2" y="3" width="16" height="6" rx="1" fill="currentColor"/><rect x="21" y="4" width="2" height="4" rx="0.5" fill="currentColor"/></svg>
          </span>
        </div>

        <div className="phone-msg-header">
          <div style={{ height: 4 }} />
          <div className="phone-msg-avatar">B</div>
          <div className="phone-msg-name">
            Bay Branch Farm
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#999" }}>
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
          <div className="phone-msg-handle">+1 (216) 555-0148</div>
        </div>

        <div className="phone-msg-thread">
          <div className="phone-msg-time">
            <strong>Saturday</strong> · 8:00 AM
          </div>

          <div className="phone-msg-bubble has-tail">
            {smsBody.split("\n").map((line, i) => {
              const isLink = /bushel\.farm\/c\//.test(line);
              if (isLink) {
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    <span className="phone-msg-link">{line}</span>
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {line || "\u00A0"}
                </React.Fragment>
              );
            })}

            <div className="phone-msg-preview">
              <div className="phone-msg-preview-img">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2.5c0 8-4.5 14.5-12 14.5-1.4 0-2.8-.2-4-.7"/>
                  <path d="M3 21c0-6 4-12 14-15"/>
                </svg>
              </div>
              <div className="phone-msg-preview-meta">
                <span className="phone-msg-preview-domain">bushel.farm</span>
                <span className="phone-msg-preview-title">{weekLabel} · Bay Branch Farm</span>
              </div>
            </div>
          </div>
        </div>

        <div className="phone-bottom">
          <div className="phone-input">
            <span style={{ flex: 1 }}>iMessage</span>
            <span className="phone-input-send">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 15-6-6-6 6"/>
              </svg>
            </span>
          </div>
          <div className="phone-home-bar" />
        </div>
      </div>
    </div>
  );
}
