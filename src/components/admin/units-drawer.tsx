"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Switch } from "@/components/ui/switch";
import { saveProductUnits, type UnitInput } from "@/actions/save-product-units";
import { setBaseUnit } from "@/actions/set-base-unit";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";

export type ProductUnitState = {
  id: string;
  isNew?: boolean;
  label: string;
  conversion_to_base: number;
  unit_price_cents: number;
  is_active: boolean;
  sort_order: number | null;
  // DEC-043: Wave "Item Number" for this unit's export lines. Null → the
  // generated slug covers the export; editable so Annabel can match her
  // existing Wave catalog.
  sku: string | null;
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
  // #208 — "Make base" promotion. Target unit pending confirmation, plus its
  // own transition so the Save button's label/disabled logic stays untouched.
  const [makeBaseTarget, setMakeBaseTarget] = useState<ProductUnitState | null>(null);
  const [rebasing, startRebasing] = useTransition();

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
        orig.is_active !== u.is_active ||
        (orig.sku ?? "") !== (u.sku ?? "")
      ) {
        return true;
      }
    }
    return false;
  }, [units, initialUnits, deletedIds]);

  // #129 — guard against losing in-progress unit edits when Annabel clicks
  // the sidebar nav (or browser-backs) mid-edit. Suspend while saving so
  // the success path (onSaved → unmount) doesn't bounce. The in-drawer
  // close paths (scrim / X / Cancel / Escape) bypass the hook because
  // they don't navigate — wrap onClose to prompt explicitly.
  const guardActive = dirty && !saving;
  useUnsavedChangesGuard(guardActive);

  const busy = saving || rebasing;

  function tryClose() {
    if (guardActive && !window.confirm("You have unsaved changes — leave anyway?")) {
      return;
    }
    onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // While the Make-base confirm is up, Escape belongs to the modal
      // (ConfirmModal handles its own keydown) — don't also close the drawer.
      if (e.key === "Escape" && !busy && !makeBaseTarget) tryClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // tryClose closes over guardActive/onClose; busy + the modal flag are deps too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, busy, guardActive, makeBaseTarget]);

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
        sku: null,
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
      sku: u.sku?.trim() || null,
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

  // #208 — promote the confirmed unit to base. Calls the atomic set_base_unit
  // RPC immediately (NOT staged into the drawer's Save — it rescales live
  // stock server-side). Only reachable from a clean drawer, so closing via
  // onSaved() can't clobber staged edits; reopening shows the rebased units.
  function handleMakeBase() {
    if (!makeBaseTarget) return;
    const target = makeBaseTarget;
    startRebasing(async () => {
      let result;
      try {
        result = await setBaseUnit(productId, target.id);
      } catch (e) {
        setMakeBaseTarget(null);
        setError(e instanceof Error ? e.message : "Couldn't change the base unit. Try again.");
        return;
      }
      if (result.error) {
        setMakeBaseTarget(null);
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <>
      <div className="drawer-scrim" onClick={() => !busy && tryClose()} aria-hidden="true" />
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
            onClick={tryClose}
            aria-label="Close drawer"
            disabled={busy}
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
              <span className="units-col-sku" title="Wave Item Number for this unit's invoice lines. Blank uses the generated slug.">
                SKU
              </span>
              <span className="units-col-active">Active</span>
              <span className="units-col-trash" />
            </div>

            {units.map((u) => {
              const isBase = u.id === baseId;
              // "Make base" only on saved, active, non-base rows — a new row
              // has no DB id to promote, and an inactive unit can't be base.
              const canMakeBase = !isBase && !u.isNew && u.is_active;
              return (
                <UnitRow
                  key={u.id}
                  unit={u}
                  isBase={isBase}
                  onUpdate={(patch) => update(u.id, patch)}
                  onRemove={() => remove(u.id)}
                  onMakeBase={canMakeBase ? () => setMakeBaseTarget(u) : null}
                  // Re-basing closes + reloads the drawer, which would clobber
                  // staged edits — require a clean drawer first.
                  makeBaseDisabled={dirty || busy}
                  makeBaseTitle={
                    dirty ? "Save your unit changes first" : `Make ${u.label || "this unit"} the base unit`
                  }
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
          {/* Cancel is the explicit "discard" button — skips the guard
              intentionally. Scrim/X/Escape still prompt. */}
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!dirty || busy} dirty={dirty}>
            {saving ? "Saving…" : dirty ? "Save units" : "Saved"}
          </Button>
        </footer>
      </aside>

      {makeBaseTarget && (
        <ConfirmModal
          title={`Make "${makeBaseTarget.label}" the base unit?`}
          body={
            <>
              <strong>{productName || "This product"}</strong> will be counted and sold in{" "}
              <strong>{makeBaseTarget.label}</strong> — conversions and stock are recalculated
              to match, and customers will see {makeBaseTarget.label} by default. Prices
              don&apos;t change.
            </>
          }
          confirmLabel="Make base"
          busy={rebasing}
          onConfirm={handleMakeBase}
          onCancel={() => !rebasing && setMakeBaseTarget(null)}
        />
      )}
    </>
  );
}

function UnitRow({
  unit,
  isBase,
  onUpdate,
  onRemove,
  onMakeBase,
  makeBaseDisabled,
  makeBaseTitle,
}: {
  unit: ProductUnitState;
  isBase: boolean;
  onUpdate: (patch: Partial<ProductUnitState>) => void;
  onRemove: () => void;
  // null hides the affordance (base row, new row, inactive unit)
  onMakeBase: (() => void) | null;
  makeBaseDisabled: boolean;
  makeBaseTitle: string;
}) {
  // Decimal-bug: type="number" + a re-formatted controlled value fights
  // mid-typing ("1.5" reformats to "1.50" before the 5 lands, cursor
  // jumps). Local drafts hold the raw user input until blur.
  const [convDraft, setConvDraft] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<string | null>(null);
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
        {onMakeBase && (
          <button
            type="button"
            className="units-make-base"
            onClick={onMakeBase}
            disabled={makeBaseDisabled}
            title={makeBaseTitle}
            aria-label={`Make ${unit.label || "unit"} the base unit`}
          >
            Make base
          </button>
        )}
      </div>
      <div className="units-col-conv">
        <input
          type="text"
          inputMode="decimal"
          className="field-input field-num"
          value={convDraft ?? String(unit.conversion_to_base)}
          onChange={(e) => {
            setConvDraft(e.target.value);
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v) && v >= 0) {
              onUpdate({ conversion_to_base: v });
            }
          }}
          onBlur={() => setConvDraft(null)}
          disabled={isBase}
          aria-label="Conversion to base"
          title={isBase ? "Base unit is always 1.0" : ""}
        />
      </div>
      <div className="units-col-price">
        <div className="field-price">
          <span className="field-price-sym">$</span>
          <input
            type="text"
            inputMode="decimal"
            className="field-input field-num"
            value={priceDraft ?? priceToString(unit.unit_price_cents)}
            onChange={(e) => {
              setPriceDraft(e.target.value);
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v) && v >= 0) {
                onUpdate({ unit_price_cents: Math.round(v * 100) });
              }
            }}
            onBlur={() => setPriceDraft(null)}
            aria-label="Unit price"
          />
        </div>
      </div>
      <div className="units-col-sku">
        <input
          type="text"
          className="field-input"
          value={unit.sku ?? ""}
          onChange={(e) => onUpdate({ sku: e.target.value })}
          placeholder="Wave item #"
          aria-label={`SKU: ${unit.label || "unit"}`}
        />
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
