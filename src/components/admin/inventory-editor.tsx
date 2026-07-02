"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MetaPill, MetaRow } from "@/components/ui/meta-pill";
import { StatusDot } from "@/components/ui/status-dot";
import { SaveBar } from "@/components/ui/save-bar";
import { InventoryRow, type InventoryRowState } from "@/components/admin/inventory-row";
import { UnitsDrawer, type ProductUnitState } from "@/components/admin/units-drawer";
import { saveInventory } from "@/actions/save-inventory";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";
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
  soldByProductId: Record<string, number>;
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

export function InventoryEditor({ initialRows, initialUnits, soldByProductId, weekLabel, schedule, customerStats }: Props) {
  const scheduleDescription = describeSchedule(schedule);
  const router = useRouter();
  const [rows, setRows] = useState<InventoryRowState[]>(initialRows);
  const [baseline, setBaseline] = useState<InventoryRowState[]>(initialRows);
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [unitsOpenFor, setUnitsOpenFor] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const baselineMap = useMemo(() => {
    const m = new Map<string, InventoryRowState>();
    baseline.forEach((r) => m.set(r.id, r));
    return m;
  }, [baseline]);

  const dirtyCount = useMemo(() => {
    // #207 — hiding is an is_active field change on the row (persisted via the
    // normal Save), so the JSON diff below already counts it. No separate
    // deleted-ids tally.
    let count = 0;
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
  }, [rows, baselineMap]);

  const dirty = dirtyCount > 0;
  // #129 — suspend the guard while a save is in flight; the success path
  // resets baseline (dirty→false naturally) and then router.refresh, but
  // the in-flight window is brief and shouldn't prompt.
  useUnsavedChangesGuard(dirty && !saving);

  // After router.refresh() (called by save handlers + the Pre-populate
  // button), the parent server component re-renders with fresh
  // initialRows but useState locks in the first value. Re-sync local
  // state when the prop changes — but only when the editor is clean,
  // so an in-flight edit isn't clobbered by a concurrent refresh.
  //
  // initialUnits flows directly through props to InventoryRow + the
  // UnitsDrawer; nothing in this component mirrors it into useState,
  // so it doesn't participate in this resync.
  //
  // Last-write-wins across concurrent tabs: if a second admin saves
  // mid-edit, this useEffect skips the resync (dirty=1) and the local
  // edit survives. On the user's next save, the post-save refresh
  // pulls in the other tab's changes. Accepted tradeoff for single-
  // admin V1.
  const dirtyRef = useRef(dirty);
  // eslint-disable-next-line react-hooks/refs -- intentional: mirror latest `dirty` into a ref read only inside the effect below (guards a mid-edit resync); not used during render.
  dirtyRef.current = dirty;
  // Only adopt fresh server data when it actually differs from our current
  // baseline. This guards two cases that would otherwise clobber an edit:
  //   1. The mount run — useState already seeded rows + baseline from
  //      initialRows, so re-setting them is redundant.
  //   2. A spurious re-render that hands us a new initialRows *reference* with
  //      identical content (observed on WebKit/mobile during hydration). The
  //      old reference-only guard would fire setRows(initialRows) and drop a
  //      qty edit typed in the same tick — the local field draft survives, so
  //      the input shows the new value while the dirty count silently stays 0.
  // A genuine change (router.refresh() after save, or a
  // concurrent-tab write) differs in content and resyncs as before.
  const baselineRef = useRef(baseline);
  // eslint-disable-next-line react-hooks/refs -- intentional: mirror latest `baseline` into a ref read only inside the effect below (content-diff guard); not used during render.
  baselineRef.current = baseline;
  useEffect(() => {
    if (dirtyRef.current) return;
    if (JSON.stringify(initialRows) === JSON.stringify(baselineRef.current)) return;
    setRows(initialRows);
    setBaseline(initialRows);
  }, [initialRows]);

  function update(id: string, patch: Partial<InventoryRowState>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setError(null);
  }

  // #207 — the trash button hides instead of deleting. A never-saved new row
  // has no DB row to keep, so it drops locally; a saved row is soft-hidden
  // (is_active=false) and persists on the next Save.
  function hide(id: string) {
    if (id.startsWith("new-")) {
      setRows((rs) => rs.filter((r) => r.id !== id));
    } else {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, is_active: false } : r)));
    }
    setError(null);
  }

  function restore(id: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, is_active: true } : r)));
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
        is_active: true,
        sort_order: maxOrder + 10,
      },
    ]);
    setError(null);
  }

  function handleDiscard() {
    setRows(baseline);
    setError(null);
  }

  // Drag-to-reorder (#143). Splice `from` to land immediately before `to`,
  // then rewrite sort_order to (10, 20, 30, …) so the saved order matches
  // the on-screen order. Same convention as addRow's `maxOrder + 10`.
  function reorderRows(fromId: string, toId: string) {
    if (fromId === toId) return;
    // Defensive: drop targets if dragend was dropped by the browser (rare —
    // cross-window drops, some WebView edge cases). Without this, a row can
    // stick at 40% opacity until the next re-render.
    setDraggingId(null);
    setDropTargetId(null);
    setRows((rs) => {
      const fromIdx = rs.findIndex((r) => r.id === fromId);
      if (fromIdx === -1) return rs;
      const next = rs.slice();
      const [moved] = next.splice(fromIdx, 1);
      const insertAt = next.findIndex((r) => r.id === toId);
      if (insertAt === -1) return rs;
      next.splice(insertAt, 0, moved);
      return next.map((r, i) => ({ ...r, sort_order: (i + 1) * 10 }));
    });
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
            is_active: r.is_active,
            sort_order: r.sort_order,
          })),
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
      router.refresh();
    });
  }

  const activeRows = rows.filter((r) => r.is_active);
  const hiddenCount = rows.length - activeRows.length;
  const visibleRows = showHidden ? rows : activeRows;
  const productCount = activeRows.length;

  return (
    <>
      <PageHeader
        eyebrow={`this week's list · ${productCount} product${productCount === 1 ? "" : "s"}`}
        title="Inventory"
        titleSuffix={weekLabel}
      >
        {hiddenCount > 0 && (
          <Button
            variant="secondary"
            onClick={() => setShowHidden((v) => !v)}
            aria-pressed={showHidden}
          >
            {showHidden ? `Hide hidden (${hiddenCount})` : `Show hidden (${hiddenCount})`}
          </Button>
        )}
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
              <th style={{ width: 80 }} title="Sold this week (base units)">Sold</th>
              <th style={{ width: 90, textAlign: "center" }}>Available</th>
              <th className="row-actions"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const units = initialUnits[row.id] ?? [];
              return (
                <InventoryRow
                  key={row.id}
                  row={row}
                  unitsCount={units.length}
                  inactiveExtrasCount={Math.max(0, units.filter((u) => !u.is_active).length)}
                  soldThisWeek={soldByProductId[row.id] ?? 0}
                  onUpdate={(patch) => update(row.id, patch)}
                  onRemove={() => hide(row.id)}
                  onRestore={() => restore(row.id)}
                  onOpenUnits={row.isNew ? undefined : () => setUnitsOpenFor(row.id)}
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
