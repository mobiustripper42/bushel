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
}: Props) {
  const [descOpen, setDescOpen] = useState(false);
  const qtyClass =
    row.qty_available === 0 ? " is-zero" : row.qty_available <= 3 ? " is-low" : "";
  const extras = Math.max(0, unitsCount - 1);

  return (
    <>
      <tr
        className={"data-row" + (!row.is_available ? " is-disabled" : "")}
        data-row-id={row.id}
        data-row-name={row.name}
      >
        <td className="row-handle">
          <span className="row-handle-grip" title="Drag to reorder">
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
              type="number"
              step="0.25"
              min="0"
              className="field-input field-num"
              value={priceToString(row.price_cents)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onUpdate({ price_cents: Number.isFinite(v) ? Math.round(v * 100) : 0 });
              }}
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
            type="number"
            min="0"
            className={"field-input field-num" + qtyClass}
            value={String(row.qty_available)}
            onChange={(e) => onUpdate({ qty_available: parseInt(e.target.value, 10) || 0 })}
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
