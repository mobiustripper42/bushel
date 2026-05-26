"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

const CATEGORIES = ["Vegetables", "Fruit", "Herbs", "Flowers", "Other"] as const;

export type InventoryRowState = {
  id: string;
  isNew?: boolean;
  name: string;
  category: string;
  description: string | null;
  unit: string;
  price_cents: number;
  qty_available: number;
  is_available: boolean;
  sort_order: number | null;
};

type Props = {
  row: InventoryRowState;
  unitsCount?: number;
  inactiveExtrasCount?: number;
  onUpdate: (patch: Partial<InventoryRowState>) => void;
  onRemove: () => void;
  onOpenUnits?: () => void;
  // Drag-to-reorder (#143). The row is only `draggable` while the grip is
  // armed (onMouseDown on grip → arm; onDragEnd → disarm) so clicks into
  // fields don't accidentally start a drag.
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: () => void;
  onDragOverRow?: () => void;
  onDropRow?: () => void;
  onDragEnd?: () => void;
};

function priceToString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function InventoryRow({
  row,
  unitsCount = 1,
  inactiveExtrasCount = 0,
  onUpdate,
  onRemove,
  onOpenUnits,
  isDragging = false,
  isDropTarget = false,
  onDragStart,
  onDragOverRow,
  onDropRow,
  onDragEnd,
}: Props) {
  const [descOpen, setDescOpen] = useState(false);
  const [dragArmed, setDragArmed] = useState(false);
  // #129/decimal-bug: keep the user's raw typing while focused so React's
  // re-render of the canonical formatted value doesn't fight mid-edit
  // ("1.5" → reformatted to "1.50" → cursor jump → can't type the 5).
  // Same draft pattern for qty so Backspace-to-empty doesn't silently
  // zero the row via parseInt("") || 0.
  const [priceDraft, setPriceDraft] = useState<string | null>(null);
  const [qtyDraft, setQtyDraft] = useState<string | null>(null);
  const qtyClass =
    row.qty_available === 0 ? " is-zero" : row.qty_available <= 3 ? " is-low" : "";
  const extras = Math.max(0, unitsCount - 1);

  const rowClass =
    "data-row" +
    (!row.is_available ? " is-disabled" : "") +
    (isDragging ? " is-dragging" : "") +
    (isDropTarget ? " is-drop-target" : "");

  return (
    <>
      <tr
        className={rowClass}
        data-row-id={row.id}
        data-row-name={row.name}
        draggable={dragArmed}
        onDragStart={(e) => {
          // Firefox refuses to start a drag without setData; the value
          // isn't read on drop (the editor's draggingId is source of truth).
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", row.id);
          onDragStart?.();
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
          onDragEnd?.();
        }}
      >
        <td className="row-handle">
          <span
            className="row-handle-grip"
            title="Drag to reorder"
            onMouseDown={() => setDragArmed(true)}
            onMouseUp={() => setDragArmed(false)}
            style={{ cursor: "grab" }}
          >
            <svg viewBox="0 0 12 18" width="10" height="14" aria-hidden="true">
              <circle cx="3" cy="3" r="1.5" fill="currentColor" />
              <circle cx="9" cy="3" r="1.5" fill="currentColor" />
              <circle cx="3" cy="9" r="1.5" fill="currentColor" />
              <circle cx="9" cy="9" r="1.5" fill="currentColor" />
              <circle cx="3" cy="15" r="1.5" fill="currentColor" />
              <circle cx="9" cy="15" r="1.5" fill="currentColor" />
            </svg>
          </span>
        </td>
        <td>
          <input
            type="text"
            className="field-input"
            value={row.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Product name…"
            aria-label="Product name"
          />
          {!descOpen && (
            <button
              type="button"
              className="field-desc-toggle"
              onClick={() => setDescOpen(true)}
            >
              {row.description ? (
                <span className="field-desc-preview">{row.description}</span>
              ) : (
                <span className="field-desc-placeholder">+ description</span>
              )}
            </button>
          )}
        </td>
        <td>
          <select
            className="field-input field-select"
            value={row.category}
            onChange={(e) => onUpdate({ category: e.target.value })}
            aria-label="Category"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </td>
        <td>
          <div className="field-price">
            <span className="field-price-sym">$</span>
            <input
              type="text"
              inputMode="decimal"
              className="field-input field-num"
              value={priceDraft ?? priceToString(row.price_cents)}
              onChange={(e) => {
                setPriceDraft(e.target.value);
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v >= 0) {
                  onUpdate({ price_cents: Math.round(v * 100) });
                }
              }}
              onBlur={() => setPriceDraft(null)}
              aria-label="Price"
            />
          </div>
        </td>
        <td>
          <input
            type="text"
            className="field-input"
            value={row.unit}
            onChange={(e) => onUpdate({ unit: e.target.value })}
            placeholder="per lb"
            aria-label="Unit"
          />
          {onOpenUnits && (
            <button
              type="button"
              className={"units-chip" + (extras > 0 ? " is-multi" : "")}
              onClick={onOpenUnits}
              aria-label={
                extras > 0
                  ? `Edit units for ${row.name || "row"} (${unitsCount} total)`
                  : `Add another unit for ${row.name || "row"}`
              }
              title={extras > 0 ? "Edit units" : "Add another unit"}
            >
              {extras === 0 ? (
                <>
                  <span className="units-chip-plus">+</span>
                  <span>Add unit</span>
                </>
              ) : (
                <>
                  <span className="units-chip-count">{unitsCount}</span>
                  <span>
                    units
                    {inactiveExtrasCount > 0 ? ` · ${inactiveExtrasCount} off` : ""}
                  </span>
                </>
              )}
            </button>
          )}
        </td>
        <td>
          <input
            type="text"
            inputMode="decimal"
            className={"field-input field-num" + qtyClass}
            value={qtyDraft ?? String(row.qty_available)}
            onChange={(e) => {
              setQtyDraft(e.target.value);
              if (e.target.value.trim() === "") return; // don't zero on Backspace-to-empty
              const v = parseFloat(e.target.value);
              // Negatives allowed per DEC-012 (admin records oversold state by
              // direct entry). Server validator agrees — Number.isFinite only.
              if (Number.isFinite(v)) {
                onUpdate({ qty_available: Math.round(v * 100) / 100 });
              }
            }}
            onBlur={() => setQtyDraft(null)}
            aria-label="Quantity available"
          />
        </td>
        <td style={{ width: 90, textAlign: "center" }}>
          <Switch
            checked={row.is_available}
            onChange={(v) => onUpdate({ is_available: v })}
            ariaLabel={`Available: ${row.name || "new row"}`}
          />
        </td>
        <td className="row-actions">
          <button
            type="button"
            className="row-trash"
            onClick={onRemove}
            title="Delete row"
            aria-label={`Delete ${row.name || "new row"}`}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
              <path d="M19 6 17.5 20a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6 M14 11v6" />
            </svg>
          </button>
        </td>
      </tr>
      {descOpen && (
        <tr className="data-row data-row-sub">
          <td className="row-handle" />
          <td colSpan={7}>
            <input
              type="text"
              className="field-input field-desc-input"
              value={row.description ?? ""}
              onChange={(e) => onUpdate({ description: e.target.value || null })}
              placeholder="Optional note for the customer — picked yesterday, last batch this week, etc."
              aria-label="Description"
              autoFocus
            />
          </td>
        </tr>
      )}
    </>
  );
}
