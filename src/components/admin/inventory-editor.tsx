"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MetaPill, MetaRow } from "@/components/ui/meta-pill";
import { StatusDot } from "@/components/ui/status-dot";
import { SaveBar } from "@/components/ui/save-bar";
import { InventoryRow, type InventoryRowState } from "@/components/admin/inventory-row";
import { PrepopulateButton } from "@/components/admin/prepopulate-button";
import { UnitsDrawer, type ProductUnitState } from "@/components/admin/units-drawer";
import { saveInventory } from "@/actions/save-inventory";
import { formatTime, shortDay } from "@/lib/schedule-format";

export type ScheduleSummary = {
  isOpen: boolean;
  openDay: number | null;
  openTime: string | null;
  closeDay: number | null;
  closeTime: string | null;
};

export type CustomerStats = {
  subscribed: number;
  orderedThisWeek: number;
};

type Props = {
  initialRows: InventoryRowState[];
  initialUnits: Record<string, ProductUnitState[]>;
  weekLabel: string;
  schedule: ScheduleSummary;
  customerStats: CustomerStats;
};

function describeSchedule(s: ScheduleSummary): { open: boolean; label: string } {
  const hasWeekly =
    s.openDay != null && s.openTime != null && s.closeDay != null && s.closeTime != null;
  if (!s.isOpen) return { open: false, label: "Closed" };
  if (!hasWeekly) return { open: true, label: "Open · manual" };
  return {
    open: true,
    label: `Open · ${shortDay(s.openDay!)} ${formatTime(s.openTime!)} – ${shortDay(s.closeDay!)} ${formatTime(s.closeTime!)}`,
  };
}

let nextLocalId = 1;
function newLocalId(): string {
  return `new-${Date.now()}-${nextLocalId++}`;
}

export function InventoryEditor({ initialRows, initialUnits, weekLabel, schedule, customerStats }: Props) {
  const scheduleDescription = describeSchedule(schedule);
  const router = useRouter();
  const [rows, setRows] = useState<InventoryRowState[]>(initialRows);
  const [baseline, setBaseline] = useState<InventoryRowState[]>(initialRows);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [unitsOpenFor, setUnitsOpenFor] = useState<string | null>(null);

  const baselineMap = useMemo(() => {
    const m = new Map<string, InventoryRowState>();
    baseline.forEach((r) => m.set(r.id, r));
    return m;
  }, [baseline]);

  const dirtyCount = useMemo(() => {
    let count = deletedIds.length;
    for (const row of rows) {
      if (row.isNew) {
        count += 1;
        continue;
      }
      const orig = baselineMap.get(row.id);
      if (!orig || JSON.stringify(orig) !== JSON.stringify(row)) {
        count += 1;
      }
    }
    return count;
  }, [rows, baselineMap, deletedIds]);

  const dirty = dirtyCount > 0;

  function update(id: string, patch: Partial<InventoryRowState>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setError(null);
  }

  function remove(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    if (!id.startsWith("new-")) {
      setDeletedIds((ids) => [...ids, id]);
    }
    setError(null);
  }

  function addRow() {
    const maxOrder = rows.reduce(
      (max, r) => Math.max(max, r.sort_order ?? 0),
      0,
    );
    setRows((rs) => [
      ...rs,
      {
        id: newLocalId(),
        isNew: true,
        name: "",
        category: "Vegetables",
        description: null,
        unit: "per lb",
        price_cents: 0,
        qty_available: 0,
        is_available: true,
        sort_order: maxOrder + 10,
      },
    ]);
    setError(null);
  }

  function handleDiscard() {
    setRows(baseline);
    setDeletedIds([]);
    setError(null);
  }

  function handleSave() {
    setError(null);
    startSaving(async () => {
      let result;
      try {
        result = await saveInventory({
          rows: rows.map((r) => ({
            id: r.id,
            isNew: r.isNew,
            name: r.name,
            category: r.category,
            description: r.description,
            unit: r.unit,
            price_cents: r.price_cents,
            qty_available: r.qty_available,
            is_available: r.is_available,
            sort_order: r.sort_order,
          })),
          deletedIds,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed. Try again.");
        return;
      }

      // Always remap any rows that did get inserted, even on partial failure —
      // prevents duplicate inserts on retry.
      const mapped = rows.map((r) => {
        if (r.isNew && result.newIdMap?.[r.id]) {
          return { ...r, id: result.newIdMap[r.id], isNew: false };
        }
        return r;
      });
      setRows(mapped);

      if (result.error) {
        setError(result.error);
        return;
      }

      setBaseline(mapped);
      setDeletedIds([]);
      router.refresh();
    });
  }

  const productCount = rows.length;

  return (
    <>
      <PageHeader
        eyebrow={`this week's list · ${productCount} product${productCount === 1 ? "" : "s"}`}
        title="Inventory"
        titleSuffix={weekLabel}
      >
        <PrepopulateButton />
        <Button
          variant="primary"
          dirty={dirty}
          disabled={!dirty || saving}
          onClick={handleSave}
        >
          {saving
            ? "Saving…"
            : dirty
              ? `Save ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}`
              : "Saved"}
        </Button>
      </PageHeader>

      <MetaRow>
        <MetaPill label="Open for orders">
          <StatusDot open={scheduleDescription.open} /> {scheduleDescription.label}
        </MetaPill>
        <MetaPill label="Customers">
          {customerStats.subscribed} subscribed · {customerStats.orderedThisWeek} ordered
        </MetaPill>
      </MetaRow>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            background: "var(--amber-50)",
            border: "1px solid var(--amber-600)",
            borderRadius: "var(--r-sm)",
            color: "var(--ink-900)",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      <div className="data-card">
        <table className="data-table">
          <thead>
            <tr>
              <th className="row-handle"></th>
              <th style={{ width: "28%", minWidth: 220 }}>Product</th>
              <th style={{ width: 130 }}>Category</th>
              <th style={{ width: 110 }}>Price</th>
              <th style={{ width: 130 }}>Unit</th>
              <th style={{ width: 80 }}>Qty</th>
              <th style={{ width: 90, textAlign: "center" }}>Available</th>
              <th className="row-actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const units = initialUnits[row.id] ?? [];
              return (
                <InventoryRow
                  key={row.id}
                  row={row}
                  unitsCount={units.length}
                  inactiveExtrasCount={Math.max(0, units.filter((u) => !u.is_active).length)}
                  onUpdate={(patch) => update(row.id, patch)}
                  onRemove={() => remove(row.id)}
                  onOpenUnits={row.isNew ? undefined : () => setUnitsOpenFor(row.id)}
                />
              );
            })}
          </tbody>
        </table>
        <button type="button" className="add-row" onClick={addRow}>
          <span className="add-row-plus">+</span>
          <span>Add row</span>
          <span className="add-row-hint mono">↹ Tab moves between cells</span>
        </button>
      </div>

      <SaveBar
        count={dirtyCount}
        onDiscard={handleDiscard}
        onSave={handleSave}
        saving={saving}
      />

      {unitsOpenFor && (() => {
        const product = rows.find((r) => r.id === unitsOpenFor);
        if (!product) return null;
        return (
          <UnitsDrawer
            productId={unitsOpenFor}
            productName={product.name}
            initialUnits={initialUnits[unitsOpenFor] ?? []}
            onClose={() => setUnitsOpenFor(null)}
            onSaved={() => {
              setUnitsOpenFor(null);
              router.refresh();
            }}
          />
        );
      })()}
    </>
  );
}
