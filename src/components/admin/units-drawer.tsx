"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { saveProductUnits, type UnitInput } from "@/actions/save-product-units";

export type ProductUnitState = {
  id: string;
  isNew?: boolean;
  label: string;
  conversion_to_base: number;
  unit_price_cents: number;
  is_active: boolean;
  sort_order: number | null;
};

type Props = {
  productId: string;
  productName: string;
  initialUnits: ProductUnitState[];
  onClose: () => void;
  onSaved: () => void;
};

let nextLocalId = 1;
function newLocalUnitId(): string {
  return `new-unit-${Date.now()}-${nextLocalId++}`;
}

function priceToString(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Base unit is the row whose conversion_to_base = 1.0 (the canonical 1× unit
// the others scale against). UI locks its conversion and hides the delete
// button. Schema has no is_base flag — base-by-convention is enough because
// the server enforces ≥1 unit + ≥1 active + conversion > 0, and the trigger
// from 6.5a always seeds a conv=1 row per product.
//
// If multiple rows somehow have conv=1, sort_order then id tiebreak — but
// the 6.5b drawer prevents that path from the UI (base row's conv is
// disabled), and the server has no migration to introduce it.
function pickBaseId(units: ProductUnitState[]): string | null {
  if (units.length === 0) return null;
  const sorted = [...units].sort((a, b) => {
    const da = Math.abs(a.conversion_to_base - 1);
    const db = Math.abs(b.conversion_to_base - 1);
    if (da !== db) return da - db;
    const sa = a.sort_order ?? Number.POSITIVE_INFINITY;
    const sb = b.sort_order ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa - sb;
    return a.id.localeCompare(b.id);
  });
  return sorted[0].id;
}

export function UnitsDrawer({ productId, productName, initialUnits, onClose, onSaved }: Props) {
  const [units, setUnits] = useState<ProductUnitState[]>(initialUnits);
  // Contract: parent unmounts this component on close (inventory-editor
  // conditional renders on unitsOpenFor). deletedIds therefore lives only
  // for the current open. If a future refactor keeps the drawer mounted
  // across opens, this list needs an explicit reset on open.
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const baseId = useMemo(() => pickBaseId(initialUnits), [initialUnits]);

  const dirty = useMemo(() => {
    if (deletedIds.length > 0) return true;
    if (units.length !== initialUnits.length) return true;
    const byId = new Map(initialUnits.map((u) => [u.id, u]));
    for (const u of units) {
      const orig = byId.get(u.id);
      if (!orig) return true;
      if (
        orig.label !== u.label ||
        orig.conversion_to_base !== u.conversion_to_base ||
        orig.unit_price_cents !== u.unit_price_cents ||
        orig.is_active !== u.is_active
      ) {
        return true;
      }
    }
    return false;
  }, [units, initialUnits, deletedIds]);

  function update(id: string, patch: Partial<ProductUnitState>) {
    setUnits((us) => us.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    setError(null);
  }

  function remove(id: string) {
    setUnits((us) => us.filter((u) => u.id !== id));
    if (!id.startsWith("new-unit-")) {
      setDeletedIds((ids) => [...ids, id]);
    }
    setError(null);
  }

  function addUnit() {
    const maxOrder = units.reduce(
      (max, u) => Math.max(max, u.sort_order ?? 0),
      0,
    );
    setUnits((us) => [
      ...us,
      {
        id: newLocalUnitId(),
        isNew: true,
        label: "",
        conversion_to_base: 1,
        unit_price_cents: 0,
        is_active: true,
        sort_order: maxOrder + 10,
      },
    ]);
    setError(null);
  }

  function handleSave() {
    const trimmed = units.map((u) => ({ ...u, label: u.label.trim() }));

    for (const u of trimmed) {
      if (!u.label) { setError("Every unit needs a label."); return; }
    }
    const labels = trimmed.map((u) => u.label.toLowerCase());
    for (let i = 0; i < labels.length; i++) {
      if (labels.indexOf(labels[i]) !== i) {
        setError(`Two units share the label "${trimmed[i].label}". Labels must be unique within a product.`);
        return;
      }
    }
    for (const u of trimmed) {
      if (!(u.conversion_to_base > 0)) {
        setError(`Conversion must be greater than zero (check "${u.label}").`);
        return;
      }
      if (!Number.isInteger(u.unit_price_cents) || u.unit_price_cents < 0) {
        setError(`Price must be a non-negative amount (check "${u.label}").`);
        return;
      }
    }
    if (!trimmed.some((u) => u.is_active)) {
      setError("At least one unit must stay active.");
      return;
    }

    const payload: UnitInput[] = trimmed.map((u) => ({
      id: u.isNew ? null : u.id,
      label: u.label,
      conversion_to_base: u.conversion_to_base,
      unit_price_cents: u.unit_price_cents,
      is_active: u.is_active,
      sort_order: u.sort_order,
    }));

    setError(null);
    startSaving(async () => {
      let result;
      try {
        result = await saveProductUnits({
          productId,
          units: payload,
          deletedUnitIds: deletedIds,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed. Try again.");
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <>
      <div className="drawer-scrim" onClick={() => !saving && onClose()} aria-hidden="true" />
      <aside
        className="drawer units-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Units for ${productName}`}
      >
        <header className="drawer-head">
          <div>
            <div className="eyebrow">edit units</div>
            <h2 className="drawer-title">{productName || "Untitled product"}</h2>
            <div className="units-drawer-sub">
              Customers pick a unit when ordering. Inventory decrements in the base unit.
            </div>
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Close drawer"
            disabled={saving}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12 M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="drawer-body">
          {error && <div role="alert" className="drawer-error" style={{ marginTop: 0, marginBottom: 16 }}>{error}</div>}

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

            {units.map((u) => {
              const isBase = u.id === baseId;
              return (
                <UnitRow
                  key={u.id}
                  unit={u}
                  isBase={isBase}
                  onUpdate={(patch) => update(u.id, patch)}
                  onRemove={() => remove(u.id)}
                />
              );
            })}

            <button type="button" className="units-add-row" onClick={addUnit} disabled={saving}>
              <span className="add-row-plus">+</span>
              <span>Add another unit</span>
            </button>
          </div>

          <div className="units-help">
            <strong>Conversion</strong> is how many of the base unit one of this unit equals.
            If the base is <em>per bunch</em> and a pound of basil is roughly four bunches, the pound row&apos;s
            conversion is <span className="mono">4</span>.
            If the base is <em>per pint</em> and a quart is two pints, the quart row is <span className="mono">2</span>.
          </div>
        </div>

        <footer className="drawer-foot">
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!dirty || saving} dirty={dirty}>
            {saving ? "Saving…" : dirty ? "Save units" : "Saved"}
          </Button>
        </footer>
      </aside>
    </>
  );
}

function UnitRow({
  unit,
  isBase,
  onUpdate,
  onRemove,
}: {
  unit: ProductUnitState;
  isBase: boolean;
  onUpdate: (patch: Partial<ProductUnitState>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={
        "units-row" +
        (isBase ? " is-base" : "") +
        (!unit.is_active ? " is-inactive" : "")
      }
      data-unit-id={unit.id}
      data-unit-label={unit.label}
    >
      <div className="units-col-label">
        <input
          type="text"
          className="field-input"
          value={unit.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder={isBase ? "per lb" : "e.g. per pound"}
          aria-label={isBase ? "Base unit label" : "Unit label"}
        />
        {isBase && <span className="units-base-badge">BASE</span>}
      </div>
      <div className="units-col-conv">
        <input
          type="number"
          step="0.1"
          min="0"
          className="field-input field-num"
          value={String(unit.conversion_to_base)}
          onChange={(e) => onUpdate({ conversion_to_base: parseFloat(e.target.value) || 0 })}
          disabled={isBase}
          aria-label="Conversion to base"
          title={isBase ? "Base unit is always 1.0" : ""}
        />
      </div>
      <div className="units-col-price">
        <div className="field-price">
          <span className="field-price-sym">$</span>
          <input
            type="number"
            step="0.25"
            min="0"
            className="field-input field-num"
            value={priceToString(unit.unit_price_cents)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onUpdate({ unit_price_cents: Number.isFinite(v) ? Math.round(v * 100) : 0 });
            }}
            aria-label="Unit price"
          />
        </div>
      </div>
      <div className="units-col-active">
        <Switch
          checked={unit.is_active}
          onChange={(v) => onUpdate({ is_active: v })}
          ariaLabel={`Active: ${unit.label || "unit"}`}
        />
      </div>
      <div className="units-col-trash">
        {!isBase && (
          <button
            type="button"
            className="row-trash"
            onClick={onRemove}
            aria-label={`Delete unit ${unit.label || "row"}`}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
              <path d="M19 6 17.5 20a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6 M14 11v6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
