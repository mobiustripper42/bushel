/* Admin · Customers */

const { useState } = React;

const SEED_CUSTOMERS = [
  {
    id: "c01", name: "West Side Market — Bay Stand",
    email: "annabel@bayBranchfarm.com", phone: "216-202-5718",
    address: "1979 W 25th St, Cleveland, OH 44113",
    notify: "both", subscribed: true,
    token: "k4f8x2-w7s",
  },
  {
    id: "c02", name: "Lakewood Farmer's Market",
    email: "manager@lakewoodfarmersmarket.org", phone: "216-555-0142",
    address: "14532 Detroit Ave, Lakewood, OH 44107",
    notify: "sms", subscribed: true,
    token: "p2k9m1-lkw",
  },
  {
    id: "c03", name: "Heinen's — Rocky River",
    email: "produce@heinens.com", phone: "440-555-0188",
    address: "20137 Center Ridge Rd, Rocky River, OH 44116",
    notify: "email", subscribed: true,
    token: "t8j3n2-hrr",
  },
  {
    id: "c04", name: "Spice Kitchen + Bar",
    email: "ben.bebenroth@spicekitchen.com", phone: "216-555-0245",
    address: "5800 Detroit Ave, Cleveland, OH 44102",
    notify: "both", subscribed: true,
    token: "r5v8q1-skb",
  },
  {
    id: "c05", name: "Bar Cento",
    email: "kitchen@barcento.com", phone: "216-555-0192",
    address: "1948 W 25th St, Cleveland, OH 44113",
    notify: "sms", subscribed: true,
    token: "m9z4w7-bct",
  },
  {
    id: "c06", name: "The Plum Café",
    email: "brett@theplumcafe.com", phone: "216-555-0167",
    address: "4133 Lorain Ave, Cleveland, OH 44113",
    notify: "both", subscribed: true,
    token: "h6f2y3-plm",
  },
  {
    id: "c07", name: "Saucy Brew Works",
    email: "chef@saucybrewworks.com", phone: "216-555-0273",
    address: "2885 Detroit Ave, Cleveland, OH 44113",
    notify: "email", subscribed: false,
    token: "d4k1n8-sbw",
  },
];

function CustomersPage() {
  const [rows, setRows] = useState(SEED_CUSTOMERS);
  const [drawer, setDrawer] = useState(null); // null | "new" | customer object
  const [confirmRegen, setConfirmRegen] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const openEdit = (c) => setDrawer(c);
  const openNew  = () => setDrawer({ id: null, name: "", email: "", phone: "", address: "", notify: "both", subscribed: true, token: "" });

  const saveDrawer = (data) => {
    if (data.id) {
      setRows(rs => rs.map(r => r.id === data.id ? data : r));
    } else {
      const id = "c" + String(rows.length + 1).padStart(2, "0");
      setRows(rs => [...rs, { ...data, id, token: makeToken() }]);
    }
    setDrawer(null);
  };
  const deleteRow = (id) => {
    setRows(rs => rs.filter(r => r.id !== id));
    setDrawer(null);
  };
  const toggleSub = (id) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, subscribed: !r.subscribed } : r));

  const doCopy = (c) => {
    navigator.clipboard?.writeText(`https://bushel.bay-branch.farm/c/${c.token}`);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 1400);
  };
  const doRegen = (c) => {
    setRows(rs => rs.map(r => r.id === c.id ? { ...r, token: makeToken() } : r));
    setConfirmRegen(null);
  };

  return (
    <div className="cust-page">
      <div className="admin-page-head">
        <div>
          <div className="eyebrow" style={{marginBottom: 6}}>{rows.length} accounts · {rows.filter(r=>r.subscribed).length} subscribed</div>
          <h1 className="admin-page-title">Customers</h1>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="btn btn-secondary">Export CSV</button>
          <button type="button" className="btn btn-primary" onClick={openNew}>+ Add customer</button>
        </div>
      </div>

      <div className="cust-tableCard">
        <table className="cust-table">
          <thead>
            <tr>
              <th className="col-c-name">Name</th>
              <th className="col-c-contact">Contact</th>
              <th className="col-c-addr">Address</th>
              <th className="col-c-notify">Notify</th>
              <th className="col-c-link">Order link</th>
              <th className="col-c-sub">Subscribed</th>
              <th className="col-c-actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.id} className={"cust-row" + (!c.subscribed ? " is-unsub" : "")} onClick={() => openEdit(c)}>
                <td className="col-c-name">
                  <div className="cust-name">{c.name}</div>
                  <div className="cust-name-token mono">/c/{c.token}</div>
                </td>
                <td className="col-c-contact">
                  <div className="cust-email">{c.email}</div>
                  <div className="cust-phone mono">{c.phone}</div>
                </td>
                <td className="col-c-addr">
                  <div className="cust-addr" title={c.address}>{c.address}</div>
                </td>
                <td className="col-c-notify">
                  <span className={"chip chip-notify chip-" + c.notify}>
                    {c.notify === "sms" ? "SMS" : c.notify === "email" ? "Email" : "Both"}
                  </span>
                </td>
                <td className="col-c-link" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className={"cust-copy" + (copiedId === c.id ? " is-copied" : "")}
                    onClick={() => doCopy(c)}
                  >
                    <IconCopy/>
                    <span>{copiedId === c.id ? "Copied!" : "Copy link"}</span>
                  </button>
                  <button
                    type="button"
                    className="cust-regen"
                    onClick={() => setConfirmRegen(c)}
                  >
                    Regenerate
                  </button>
                </td>
                <td className="col-c-sub" onClick={e => e.stopPropagation()}>
                  <Switch checked={c.subscribed} onChange={() => toggleSub(c.id)}/>
                </td>
                <td className="col-c-actions">
                  <span className="cust-chev"><IconChev/></span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawer && <CustomerDrawer customer={drawer} onSave={saveDrawer} onDelete={deleteRow} onClose={() => setDrawer(null)}/>}

      {confirmRegen && (
        <ConfirmModal
          title="Regenerate order link?"
          body={<>This breaks <strong>{confirmRegen.name}</strong>'s existing bookmark. They'll need a new link by text or email.</>}
          confirmLabel="Yes, regenerate"
          confirmDanger
          onConfirm={() => doRegen(confirmRegen)}
          onCancel={() => setConfirmRegen(null)}
        />
      )}
    </div>
  );
}

/* Drawer */
function CustomerDrawer({ customer, onSave, onDelete, onClose }) {
  const [c, setC] = useState(customer);
  const isNew = !customer.id;
  const set = (patch) => setC(prev => ({ ...prev, ...patch }));

  return (
    <>
      <div className="drawer-scrim" onClick={onClose}></div>
      <aside className="drawer">
        <header className="drawer-head">
          <div>
            <div className="eyebrow">{isNew ? "new customer" : "edit customer"}</div>
            <h2 className="drawer-title">{isNew ? "Add a new customer" : c.name || "—"}</h2>
            {!isNew && <div className="drawer-token mono">/c/{c.token}</div>}
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            <IconClose/>
          </button>
        </header>

        <div className="drawer-body">
          <Field label="Customer name" hint="How you refer to them — usually the business name.">
            <input type="text" value={c.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. West Side Market"/>
          </Field>

          <div className="field-row">
            <Field label="Email">
              <input type="email" value={c.email} onChange={e => set({ email: e.target.value })} placeholder="orders@…"/>
            </Field>
            <Field label="Phone">
              <input type="tel" value={c.phone} onChange={e => set({ phone: e.target.value })} placeholder="216-555-0100"/>
            </Field>
          </div>

          <Field label="Delivery address" hint="Used on order confirmations and the delivery list.">
            <textarea rows={3} value={c.address} onChange={e => set({ address: e.target.value })} placeholder="Street, city, zip"/>
          </Field>

          <Field label="Notification preference">
            <div className="radio-group">
              {[
                { v: "sms",   l: "SMS only",   s: "Best for restaurant kitchens." },
                { v: "email", l: "Email only", s: "If they prefer paper trail." },
                { v: "both",  l: "SMS + Email", s: "Sends both — recommended." },
              ].map(opt => (
                <label key={opt.v} className={"radio-card" + (c.notify === opt.v ? " is-on" : "")}>
                  <input type="radio" name="notify" checked={c.notify === opt.v} onChange={() => set({ notify: opt.v })}/>
                  <div>
                    <div className="radio-card-label">{opt.l}</div>
                    <div className="radio-card-sub">{opt.s}</div>
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Subscribed" hint="When off, they won't receive weekly order links.">
            <div style={{display: "flex", alignItems: "center", gap: 12}}>
              <Switch checked={c.subscribed} onChange={v => set({ subscribed: v })}/>
              <span style={{color: "var(--ink-700)", fontSize: "0.92rem"}}>
                {c.subscribed ? "Will receive this week's link" : "Paused"}
              </span>
            </div>
          </Field>
        </div>

        <footer className="drawer-foot">
          {!isNew && (
            <button type="button" className="btn btn-destructive" onClick={() => onDelete(c.id)}>
              Delete customer
            </button>
          )}
          <div style={{flex: 1}}></div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(c)}>
            {isNew ? "Add customer" : "Save changes"}
          </button>
        </footer>
      </aside>
    </>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="field-control">{children}</div>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, confirmDanger, onConfirm, onCancel }) {
  return (
    <>
      <div className="modal-scrim" onClick={onCancel}></div>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-icon">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4"/><path d="M12 17h.01"/>
            <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"/>
          </svg>
        </div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-body">{body}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className={"btn " + (confirmDanger ? "btn-destructive-solid" : "btn-primary")} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

function Switch({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={"inv-switch" + (checked ? " is-on" : "")}>
      <span className="inv-switch-thumb"></span>
    </button>
  );
}

function makeToken() {
  return Math.random().toString(36).slice(2, 8) + "-" + Math.random().toString(36).slice(2, 5);
}

function IconCopy() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
  </svg>;
}
function IconChev() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>;
}
function IconClose() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12 M18 6 6 18"/></svg>;
}

window.CustomersPage = CustomersPage;
