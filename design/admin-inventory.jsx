/* Admin · Inventory editor */

const { useState, useMemo, useRef, useEffect } = React;

const CATEGORIES = ["Vegetables", "Fruit", "Herbs", "Flowers", "Other"];

/* Seed inventory. Each product carries a `units` array — every product has
 * at least one row (the base unit, conversion 1.0). Multi-unit products have
 * additional rows with conversion-to-base != 1.0. The row's top-level
 * `price` + `unit` mirror the base unit and stay inline-editable for speed;
 * additional units live behind the Units drawer. */
const SEED_ROWS = [
  { id: "p01", name: "Heirloom tomatoes",   category: "Vegetables", price: 5.50, unit: "per lb",     qty: 24, desc: "Mix of Cherokee Purple, Brandywine, and Striped German.", available: true,
    units: [
      { id: "u01a", label: "per lb", conv: 1.0, price: 5.50, active: true, base: true },
    ] },
  { id: "p02", name: "Genovese basil",      category: "Herbs",      price: 3.50, unit: "per bunch",  qty: 18, desc: "Big leaves — pesto-ready.", available: true,
    units: [
      { id: "u02a", label: "per bunch", conv: 1.0,  price: 3.50,  active: true, base: true },
      { id: "u02b", label: "per lb",    conv: 0.25, price: 12.00, active: true, base: false },
    ] },
  { id: "p03", name: "Dino kale",           category: "Vegetables", price: 4.50, unit: "per bunch",  qty: 12, desc: "Lacinato. Tender stems this week.", available: true,
    units: [
      { id: "u03a", label: "per bunch", conv: 1.0, price: 4.50, active: true, base: true },
    ] },
  { id: "p04", name: "Sungold cherry tomatoes", category: "Vegetables", price: 6.00, unit: "per pint", qty: 16, desc: "Picked Tuesday. Honey-sweet.", available: true,
    units: [
      { id: "u04a", label: "per pint", conv: 1.0, price: 6.00,  active: true, base: true },
      { id: "u04b", label: "per qt",   conv: 0.5, price: 11.50, active: true, base: false },
    ] },
  { id: "p05", name: "Red beets",           category: "Vegetables", price: 3.25, unit: "per lb",     qty: 9,  desc: "Tops included — good for sautéing.", available: true,
    units: [ { id: "u05a", label: "per lb", conv: 1.0, price: 3.25, active: true, base: true } ] },
  { id: "p06", name: "Zucchini",            category: "Vegetables", price: 2.50, unit: "each",       qty: 22, desc: "Medium size, tender skin.", available: true,
    units: [ { id: "u06a", label: "each", conv: 1.0, price: 2.50, active: true, base: true } ] },
  { id: "p07", name: "Zinnia bouquet",      category: "Flowers",    price: 12.00, unit: "per bunch", qty: 6,  desc: "Mixed colors, ~15 stems.", available: true,
    units: [ { id: "u07a", label: "per bunch", conv: 1.0, price: 12.00, active: true, base: true } ] },
  { id: "p08", name: "Strawberries",        category: "Fruit",      price: 7.50, unit: "per pint",   qty: 0,  desc: "Last picking — back next week.", available: false,
    units: [ { id: "u08a", label: "per pint", conv: 1.0, price: 7.50, active: true, base: true } ] },
  { id: "p09", name: "Garlic scapes",       category: "Herbs",      price: 4.00, unit: "per bunch",  qty: 14, desc: "Curly tops, mild garlic flavor.", available: true,
    units: [ { id: "u09a", label: "per bunch", conv: 1.0, price: 4.00, active: true, base: true } ] },
  { id: "p10", name: "Rainbow chard",       category: "Vegetables", price: 4.50, unit: "per bunch",  qty: 11, desc: "Beautiful stems — yellow, magenta, white.", available: true,
    units: [ { id: "u10a", label: "per bunch", conv: 1.0, price: 4.50, active: true, base: true } ] },
];

let nextUnitId = 100;
function newUnitId() { return "u" + String(nextUnitId++); }

let nextId = 11;
function newRowId() { return "p" + String(nextId++).padStart(2, "0"); }

function InventoryPage() {
  const [rows, setRows] = useState(SEED_ROWS);
  const [originalRows] = useState(SEED_ROWS);
  const [unitsOpenFor, setUnitsOpenFor] = useState(null); // product id, or null
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);

  const reorderRows = (fromId, toId) => {
    if (fromId === toId) return;
    setRows(rs => {
      const fromIdx = rs.findIndex(r => r.id === fromId);
      if (fromIdx === -1) return rs;
      const next = rs.slice();
      const [moved] = next.splice(fromIdx, 1);
      const insertAt = next.findIndex(r => r.id === toId);
      if (insertAt === -1) return rs;
      next.splice(insertAt, 0, moved);
      return next;
    });
  };

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

  const addRow = () => {
    const baseId = newUnitId();
    setRows(rs => [...rs, {
      id: newRowId(),
      name: "", category: "Vegetables", price: 0, unit: "per lb",
      qty: 0, desc: "", available: true,
      units: [{ id: baseId, label: "per lb", conv: 1.0, price: 0, active: true, base: true }],
    }]);
  };

  /* When base-unit label/price change inline, mirror onto the product row.
   * When extra units change in the drawer, they don't touch the inline cells. */
  const saveUnits = (productId, nextUnits) => {
    const base = nextUnits.find(u => u.base);
    setRows(rs => rs.map(r => r.id === productId
      ? { ...r, unit: base ? base.label : r.unit, price: base ? base.price : r.price, units: nextUnits }
      : r));
    setUnitsOpenFor(null);
  };

  const productForDrawer = unitsOpenFor ? rows.find(r => r.id === unitsOpenFor) : null;

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
          <span className="inv-meta-val"><span className="status-dot is-open" style={{boxShadow: "0 0 0 2px rgba(121,196,78,0.18)"}}></span> Open · Sun 8am – Tue 6pm</span>
        </div>
        <div className="inv-meta-pill">
          <span className="inv-meta-key">Customers</span>
          <span className="inv-meta-val">38 subscribed · 12 ordered</span>
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
                onOpenUnits={() => setUnitsOpenFor(row.id)}
                isDragging={draggingId === row.id}
                isDropTarget={dropTargetId === row.id && draggingId !== row.id}
                onDragStart={() => setDraggingId(row.id)}
                onDragOverRow={() => {
                  if (draggingId && draggingId !== row.id) setDropTargetId(row.id);
                }}
                onDropRow={() => {
                  if (draggingId) reorderRows(draggingId, row.id);
                  setDraggingId(null);
                  setDropTargetId(null);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropTargetId(null);
                }}
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

      {productForDrawer && (
        <UnitsDrawer
          product={productForDrawer}
          onClose={() => setUnitsOpenFor(null)}
          onSave={(nextUnits) => saveUnits(productForDrawer.id, nextUnits)}
        />
      )}

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

function InventoryRow({
  row, index, onUpdate, onRemove, onOpenUnits,
  isDragging, isDropTarget,
  onDragStart, onDragOverRow, onDropRow, onDragEnd,
}) {
  const [descOpen, setDescOpen] = useState(false);
  const [dragArmed, setDragArmed] = useState(false);
  const extras = (row.units || []).filter(u => !u.base);
  const inactiveCount = extras.filter(u => !u.active).length;
  const rowClass =
    "inv-row" +
    (!row.available ? " is-unavail" : "") +
    (isDragging ? " is-dragging" : "") +
    (isDropTarget ? " is-drop-target" : "");
  return (
    <>
      <tr
        className={rowClass}
        draggable={dragArmed}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", row.id);
          onDragStart && onDragStart();
        }}
        onDragOver={(e) => {
          if (!onDragOverRow) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          onDragOverRow();
        }}
        onDrop={(e) => {
          if (!onDropRow) return;
          e.preventDefault();
          onDropRow();
          setDragArmed(false);
        }}
        onDragEnd={() => {
          setDragArmed(false);
          onDragEnd && onDragEnd();
        }}
      >
        <td className="col-handle">
          <span
            className="inv-handle"
            title="Drag to reorder"
            style={{ cursor: "grab" }}
            onMouseDown={() => setDragArmed(true)}
            onMouseUp={() => setDragArmed(false)}
          >
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
          <button
            type="button"
            className={"inv-unitsChip" + (extras.length > 0 ? " is-multi" : "")}
            onClick={onOpenUnits}
            title={extras.length > 0 ? "Edit units" : "Add another unit"}
          >
            {extras.length === 0
              ? <><span className="inv-unitsChip-plus">+</span><span>Add unit</span></>
              : <><span className="inv-unitsChip-count">{extras.length + 1}</span>
                  <span>units{inactiveCount > 0 ? ` · ${inactiveCount} off` : ""}</span></>
            }
          </button>
        </td>
        <td className="col-qty">
          <input
            type="text"
            inputMode="decimal"
            className={"inv-cell inv-num" + (row.qty === 0 ? " is-zero" : row.qty <= 3 ? " is-low" : "")}
            value={row.qty}
            onChange={e => {
              const v = parseFloat(e.target.value);
              onUpdate({ qty: Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0 });
            }}
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

/* Units drawer — per-product unit editor.
 * Base row: BASE badge, label + price editable, conversion locked at 1, no delete.
 * Extra rows: label, conversion-to-base, price, active toggle, delete.
 * Validation surfaces inline; server enforces label uniqueness + active >= 1. */
function UnitsDrawer({ product, onClose, onSave }) {
  const [units, setUnits] = useState(() => product.units.map(u => ({ ...u })));
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (id, patch) => {
    setUnits(us => us.map(u => u.id === id ? { ...u, ...patch } : u));
    setError(null);
  };
  const remove = (id) => {
    setUnits(us => us.filter(u => u.id !== id));
    setError(null);
  };
  const addUnit = () => {
    setUnits(us => [...us, {
      id: newUnitId(), label: "", conv: 1, price: 0, active: true, base: false,
    }]);
    setError(null);
  };

  const dirty = useMemo(
    () => JSON.stringify(units) !== JSON.stringify(product.units),
    [units, product.units]
  );

  const handleSave = () => {
    const labels = units.map(u => u.label.trim().toLowerCase());
    const dupe = labels.find((l, i) => l && labels.indexOf(l) !== i);
    if (dupe) { setError(`Two units share the label "${dupe}". Labels must be unique within a product.`); return; }
    const blank = units.find(u => !u.label.trim());
    if (blank) { setError("Every unit needs a label."); return; }
    const badConv = units.find(u => !u.base && (!(u.conv > 0)));
    if (badConv) { setError(`Conversion-to-base must be greater than zero (check "${badConv.label}").`); return; }
    if (!units.some(u => u.active)) { setError("At least one unit must stay active."); return; }
    onSave(units);
  };

  const baseUnit = units.find(u => u.base);
  const extras = units.filter(u => !u.base);

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside
        className="drawer units-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Units for ${product.name}`}
      >
        <header className="drawer-head">
          <div>
            <div className="eyebrow">edit units</div>
            <h2 className="drawer-title">{product.name || "Untitled product"}</h2>
            <div className="units-drawer-sub">
              Customers pick a unit when ordering. Inventory decrements in the base unit.
            </div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close drawer">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12 M18 6 6 18"/>
            </svg>
          </button>
        </header>

        <div className="drawer-body">
          {error && <div role="alert" className="drawer-error">{error}</div>}

          <div className="units-list">
            <div className="units-list-head">
              <span className="units-col-label">Label</span>
              <span className="units-col-conv" title="How many base units this equals. Base unit = 1.">
                Conversion
              </span>
              <span className="units-col-price">Price</span>
              <span className="units-col-active">Active</span>
              <span className="units-col-trash" />
            </div>

            {baseUnit && (
              <UnitRow
                unit={baseUnit}
                onUpdate={(patch) => update(baseUnit.id, patch)}
              />
            )}
            {extras.map(u => (
              <UnitRow
                key={u.id}
                unit={u}
                onUpdate={(patch) => update(u.id, patch)}
                onRemove={() => remove(u.id)}
              />
            ))}

            <button type="button" className="units-addRow" onClick={addUnit}>
              <span className="inv-addRow-plus">+</span>
              <span>Add another unit</span>
            </button>
          </div>

          <div className="units-help">
            <strong>Conversion-to-base</strong> is how much of the base unit one of this unit equals.
            If the base is <em>per bunch</em> and a pound of basil is roughly four bunches, the pound row's
            conversion is <span className="mono">4.0</span>. If the base is <em>per pint</em> and a quart is two pints,
            the quart row is <span className="mono">2.0</span>.
          </div>
        </div>

        <footer className="drawer-foot">
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className={"btn btn-primary" + (dirty ? " is-dirty" : "")} onClick={handleSave} disabled={!dirty}>
            {dirty ? "Save units" : "Saved"}
          </button>
        </footer>
      </aside>
    </>
  );
}

function UnitRow({ unit, onUpdate, onRemove }) {
  return (
    <div className={"units-row" + (unit.base ? " is-base" : "") + (!unit.active ? " is-inactive" : "")}>
      <div className="units-col-label">
        <input
          type="text"
          className="inv-cell"
          value={unit.label}
          onChange={e => onUpdate({ label: e.target.value })}
          placeholder={unit.base ? "per lb" : "e.g. per pound"}
        />
        {unit.base && <span className="units-baseBadge">BASE</span>}
      </div>
      <div className="units-col-conv">
        <input
          type="number"
          step="0.1"
          min="0"
          className="inv-cell inv-num"
          value={unit.conv}
          onChange={e => onUpdate({ conv: parseFloat(e.target.value) || 0 })}
          disabled={unit.base}
          title={unit.base ? "Base unit is always 1.0" : ""}
        />
      </div>
      <div className="units-col-price">
        <div className="inv-priceWrap">
          <span className="inv-priceSym">$</span>
          <input
            type="number"
            step="0.25"
            min="0"
            className="inv-cell inv-num"
            value={unit.price}
            onChange={e => onUpdate({ price: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div className="units-col-active">
        <Switch checked={unit.active} onChange={v => onUpdate({ active: v })}/>
      </div>
      <div className="units-col-trash">
        {!unit.base && (
          <button type="button" className="inv-trash" onClick={onRemove} aria-label="Delete unit">
            <IconTrash/>
          </button>
        )}
      </div>
    </div>
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
