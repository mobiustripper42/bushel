"use client";

import { useState, useTransition } from "react";
import { updateProduct } from "@/actions/update-product";
import type { Tables } from "@/lib/supabase/types";

type Product = Tables<"products">;

const cellStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--ink-100)",
  verticalAlign: "middle",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: "var(--r-sm)",
  padding: "4px 6px",
  fontSize: "0.875rem",
  color: "var(--ink-900)",
  fontFamily: "var(--font-sans)",
};

const inputFocusClass = "inv-input";

export function InventoryRow({ product }: { product: Product }) {
  const [name, setName] = useState(product.name);
  const [unit, setUnit] = useState(product.unit);
  const [priceStr, setPriceStr] = useState((product.price_cents / 100).toFixed(2));
  const [qtyStr, setQtyStr] = useState(String(product.qty_available));
  const [isAvailable, setIsAvailable] = useState(product.is_available);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    const price_cents = Math.round(parseFloat(priceStr) * 100);
    const qty_available = parseInt(qtyStr, 10);
    startTransition(async () => {
      const err = await updateProduct({
        id: product.id,
        name,
        unit,
        price_cents,
        qty_available,
        is_available: isAvailable,
      });
      if (err) setError(err);
      else setSaved(true);
    });
  }

  return (
    <tr>
      <td style={cellStyle}>
        <input
          className={inputFocusClass}
          style={inputStyle}
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          aria-label={`Name for ${product.name}`}
        />
      </td>
      <td style={cellStyle}>
        <input
          className={inputFocusClass}
          style={{ ...inputStyle, width: 80 }}
          value={unit}
          onChange={(e) => { setUnit(e.target.value); setSaved(false); }}
          aria-label={`Unit for ${product.name}`}
        />
      </td>
      <td style={cellStyle}>
        <input
          className={inputFocusClass}
          style={{ ...inputStyle, width: 90 }}
          type="number"
          min="0"
          step="0.01"
          value={priceStr}
          onChange={(e) => { setPriceStr(e.target.value); setSaved(false); }}
          aria-label={`Price for ${product.name}`}
        />
      </td>
      <td style={cellStyle}>
        <input
          className={inputFocusClass}
          style={{ ...inputStyle, width: 80 }}
          type="number"
          min="0"
          step="1"
          value={qtyStr}
          onChange={(e) => { setQtyStr(e.target.value); setSaved(false); }}
          aria-label={`Qty available for ${product.name}`}
        />
      </td>
      <td style={{ ...cellStyle, textAlign: "center" }}>
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => { setIsAvailable(e.target.checked); setSaved(false); }}
          aria-label={`Available for ${product.name}`}
          style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--leaf-600)" }}
        />
      </td>
      <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
        <button
          onClick={handleSave}
          disabled={pending}
          style={{
            padding: "4px 14px",
            fontSize: "0.8rem",
            fontWeight: 600,
            background: "var(--leaf-600)",
            color: "var(--paper)",
            border: "none",
            borderRadius: "var(--r-sm)",
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span style={{ marginLeft: 8, fontSize: "0.78rem", color: "var(--leaf-700)" }}>
            Saved
          </span>
        )}
        {error && (
          <span style={{ marginLeft: 8, fontSize: "0.78rem", color: "var(--destructive)" }}>
            {error}
          </span>
        )}
      </td>
    </tr>
  );
}
