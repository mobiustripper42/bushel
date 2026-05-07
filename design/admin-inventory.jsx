/* Admin · Inventory editor */

const { useState, useMemo, useRef } = React;

const CATEGORIES = ["Vegetables", "Fruit", "Herbs", "Flowers", "Other"];

const SEED_ROWS = [
  { id: "p01", name: "Heirloom tomatoes",   category: "Vegetables", price: 5.50, unit: "per lb",     qty: 24, desc: "Mix of Cherokee Purple, Brandywine, and Striped German.", available: true },
  { id: "p02", name: "Genovese basil",      category: "Herbs",      price: 3.50, unit: "per bunch",  qty: 18, desc: "Big leaves — pesto-ready.", available: true },
  { id: "p03", name: "Dino kale",           category: "Vegetables", price: 4.50, unit: "per bunch",  qty: 12, desc: "Lacinato. Tender stems this week.", available: true },
  { id: "p04", name: "Sungold cherry tomatoes", category: "Vegetables", price: 6.00, unit: "per pint", qty: 16, desc: "Picked Tuesday. Honey-sweet.", available: true },
  { id: "p05", name: "Red beets",           category: "Vegetables", price: 3.25, unit: "per lb",     qty: 9,  desc: "Tops included — good for sautéing.", available: true },
  { id: "p06", name: "Zucchini",            category: "Vegetables", price: 2.50, unit: "each",       qty: 22, desc: "Medium size, tender skin.", available: true },
  { id: "p07", name: "Zinnia bouquet",      category: "Flowers",    price: 12.00, unit: "per bunch", qty: 6,  desc: "Mixed colors, ~15 stems.", available: true },
  { id: "p08", name: "Strawberries",        category: "Fruit",      price: 7.50, unit: "per pint",   qty: 0,  desc: "Last picking — back next week.", available: false },
  { id: "p09", name: "Garlic scapes",       category: "Herbs",      price: 4.00, unit: "per bunch",  qty: 14, desc: "Curly tops, mild garlic flavor.", available: true },
  { id: "p10", name: "Rainbow chard",       category: "Vegetables", price: 4.50, unit: "per bunch",  qty: 11, desc: "Beautiful stems — yellow, magenta, white.", available: true },
];

let nextId = 11;
function newRowId() { return "p" + String(nextId++).padStart(2, "0"); }

function InventoryPage() {
  const [rows, setRows] = useState(SEED_ROWS);
  const [originalRows] = useState(SEED_ROWS);

  const dirty = useMemo(
    () => JSON.stringify(rows) !== JSON.stringify(originalRows),
    [rows, originalRows]
  );
  const dirtyCount = useMemo(() => {
    if (!dirty) return 0;
    const orig = new Map(originalRows.map(r => [r.id, r]));
    let count = 0;
    rows.forEach(r => {
      const o = orig.get(r.id);
      if (!o || JSON.stringify(o) !== JSON.stringify(r)) count++;
    });
    rows.length !== originalRows.length && (count += Math.abs(rows.length - originalRows.length));
    return count;
  }, [rows, originalRows, dirty]);

  const update = (id, patch) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));

  const remove = (id) =>
    setRows(rs => rs.filter(r => r.id !== id));

  const addRow = () =>
    setRows(rs => [...rs, {
      id: newRowId(),
      name: "", category: "Vegetables", price: 0, unit: "per lb",
      qty: 0, desc: "", available: true
    }]);

  return (
    <div className="inv-page">
      <div className="admin-page-head">
        <div>
          <div className="eyebrow" style={{marginBottom: 6}}>this week's list · 12 products</div>
          <h1 className="admin-page-title">Inventory <span className="inv-week">— Week of May 3</span></h1>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="btn btn-secondary">
            <IconHistory/>
            <span>Pre-populate from last week</span>
          </button>
          <button type="button" className={"btn btn-primary" + (dirty ? " is-dirty" : "")} disabled={!dirty}>
            {dirty ? `Save ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}` : "Saved"}
          </button>
        </div>
      </div>

      <div className="inv-meta">
        <div className="inv-meta-pill">
          <span className="inv-meta-key">Open for orders</span>
          <span className="inv-meta-val"><span className="status-dot is-open" style={{boxShadow: "0 0 0 2px rgba(121,196,78,0.18)"}}></span> Sun 8am – Tue 6pm</span>
        </div>
        <div className="inv-meta-pill">
          <span className="inv-meta-key">Customers</span>
          <span className="inv-meta-val">38 active · 12 ordered yet</span>
        </div>
        <div className="inv-meta-pill">
          <span className="inv-meta-key">Cutoff</span>
          <span className="inv-meta-val">Tue 6:00pm · 28h left</span>
        </div>
      </div>

      <div className="inv-tableCard">
        <table className="inv-table">
          <thead>
            <tr>
              <th className="col-handle"></th>
              <th className="col-name">Product</th>
              <th className="col-cat">Category</th>
              <th className="col-price">Price</th>
              <th className="col-unit">Unit</th>
              <th className="col-qty">Qty</th>
              <th className="col-avail">Available</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <InventoryRow
                key={row.id}
                row={row}
                index={i}
                onUpdate={(patch) => update(row.id, patch)}
                onRemove={() => remove(row.id)}
              />
            ))}
          </tbody>
        </table>
        <button type="button" className="inv-addRow" onClick={addRow}>
          <span className="inv-addRow-plus">+</span>
          <span>Add row</span>
          <span className="inv-addRow-hint mono">↹ Tab moves between cells</span>
        </button>
      </div>

      {dirty && (
        <div className="inv-saveBar">
          <div className="inv-saveBar-msg">
            <span className="inv-saveBar-dot"></span>
            <span><strong>{dirtyCount}</strong> unsaved {dirtyCount === 1 ? "change" : "changes"}</span>
          </div>
          <div className="inv-saveBar-actions">
            <button type="button" className="btn btn-ghost">Discard</button>
            <button type="button" className="btn btn-primary">Save changes</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryRow({ row, index, onUpdate, onRemove }) {
  const [descOpen, setDescOpen] = useState(false);
  return (
    <>
      <tr className={"inv-row" + (!row.available ? " is-unavail" : "")}>
        <td className="col-handle">
          <span className="inv-handle" title="Drag to reorder">
            <svg viewBox="0 0 12 18" width="10" height="14" aria-hidden="true">
              <circle cx="3" cy="3" r="1.5" fill="currentColor"/>
              <circle cx="9" cy="3" r="1.5" fill="currentColor"/>
              <circle cx="3" cy="9" r="1.5" fill="currentColor"/>
              <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
              <circle cx="3" cy="15" r="1.5" fill="currentColor"/>
              <circle cx="9" cy="15" r="1.5" fill="currentColor"/>
            </svg>
          </span>
        </td>
        <td className="col-name">
          <input
            type="text"
            className="inv-cell"
            value={row.name}
            onChange={e => onUpdate({ name: e.target.value })}
            placeholder="Product name…"
          />
          {!descOpen && (
            <button
              type="button"
              className={"inv-descToggle" + (row.desc ? " is-open" : "")}
              onClick={() => setDescOpen(true)}
            >
              {row.desc
                ? <span className="inv-descPreview">{row.desc}</span>
                : <span className="inv-descPlaceholder">+ description</span>}
            </button>
          )}
        </td>
        <td className="col-cat">
          <select
            className="inv-cell inv-select"
            value={row.category}
            onChange={e => onUpdate({ category: e.target.value })}
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </td>
        <td className="col-price">
          <div className="inv-priceWrap">
            <span className="inv-priceSym">$</span>
            <input
              type="number"
              step="0.25"
              min="0"
              className="inv-cell inv-num"
              value={row.price}
              onChange={e => onUpdate({ price: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </td>
        <td className="col-unit">
          <input
            type="text"
            className="inv-cell"
            value={row.unit}
            onChange={e => onUpdate({ unit: e.target.value })}
            placeholder="per lb"
          />
        </td>
        <td className="col-qty">
          <input
            type="number"
            min="0"
            className={"inv-cell inv-num" + (row.qty === 0 ? " is-zero" : row.qty <= 3 ? " is-low" : "")}
            value={row.qty}
            onChange={e => onUpdate({ qty: parseInt(e.target.value) || 0 })}
          />
        </td>
        <td className="col-avail">
          <Switch checked={row.available} onChange={v => onUpdate({ available: v })}/>
        </td>
        <td className="col-actions">
          <button
            type="button"
            className="inv-trash"
            onClick={onRemove}
            title="Delete row"
            aria-label="Delete row"
          >
            <IconTrash/>
          </button>
        </td>
      </tr>
      {descOpen && (
        <tr className="inv-row inv-descRow">
          <td className="col-handle"></td>
          <td colSpan={7}>
            <input
              type="text"
              className="inv-cell inv-descInput"
              value={row.desc}
              onChange={e => onUpdate({ desc: e.target.value })}
              placeholder="Optional note for the customer — picked yesterday, last batch this week, etc."
            />
          </td>
        </tr>
      )}
    </>
  );
}

function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={"inv-switch" + (checked ? " is-on" : "")}
    >
      <span className="inv-switch-thumb"></span>
    </button>
  );
}

/* icons */
function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7"/>
      <path d="M3 4v5h5"/>
      <path d="M12 8v5l3 2"/>
    </svg>
  );
}
function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/>
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>
      <path d="M19 6 17.5 20a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6 M14 11v6"/>
    </svg>
  );
}

window.InventoryPage = InventoryPage;
