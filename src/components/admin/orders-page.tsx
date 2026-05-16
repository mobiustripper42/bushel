"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { OrderRow } from "@/components/admin/order-row";
import type { OrderRow as OrderRowData } from "@/lib/admin/orders-queries";

type SortKey = "placed" | "customer" | "total";
type SortDir = "asc" | "desc";

type Props = {
  orders: OrderRowData[];
  weekFilter: "this" | "last";
  thisWeekCount: number;
  lastWeekCount: number;
};

function compareOrders(a: OrderRowData, b: OrderRowData, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  if (key === "placed") cmp = a.placedAt.localeCompare(b.placedAt);
  else if (key === "customer") cmp = a.customerName.localeCompare(b.customerName);
  else if (key === "total") cmp = a.totalCents - b.totalCents;
  return dir === "asc" ? cmp : -cmp;
}

function SortHeader({
  label,
  sortKey,
  current,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = current.key === sortKey;
  const indicator = isActive ? (current.dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th className={className}>
      <button
        type="button"
        className="ord-sort-btn"
        onClick={() => onSort(sortKey)}
        aria-sort={isActive ? (current.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        {indicator}
      </button>
    </th>
  );
}

export function OrdersPage({ orders, weekFilter, thisWeekCount, lastWeekCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "placed",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const copy = [...orders];
    copy.sort((a, b) => {
      if (a.needsReconciliation !== b.needsReconciliation) {
        return a.needsReconciliation ? -1 : 1;
      }
      return compareOrders(a, b, sort.key, sort.dir);
    });
    return copy;
  }, [orders, sort]);

  function handleSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: key === "placed" ? "desc" : "asc" };
    });
  }

  function setWeek(next: "this" | "last") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "this") params.delete("week");
    else params.set("week", "last");
    const qs = params.toString();
    router.push(`/admin/orders${qs ? `?${qs}` : ""}`);
  }

  const reconCount = orders.filter((o) => o.needsReconciliation).length;

  return (
    <div className="ord-page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {orders.length} orders
            {reconCount > 0 && ` · ${reconCount} need reconciliation`}
          </div>
          <h1 className="page-title">Orders</h1>
        </div>
      </div>

      <div className="ord-filters">
        <button
          type="button"
          className={"chip-tab" + (weekFilter === "this" ? " is-on" : "")}
          onClick={() => setWeek("this")}
        >
          This week <span className="chip-count">{thisWeekCount}</span>
        </button>
        <button
          type="button"
          className={"chip-tab" + (weekFilter === "last" ? " is-on" : "")}
          onClick={() => setWeek("last")}
        >
          Last week <span className="chip-count">{lastWeekCount}</span>
        </button>
        <button
          type="button"
          className="chip-tab"
          disabled
          title="Coming in Phase 6"
        >
          Custom range
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="ord-empty">No orders for this week yet.</div>
      ) : (
        <div className="ord-tableCard">
          <table className="ord-table" aria-label="Orders">
            <thead>
              <tr>
                <th className="col-o-id">Order</th>
                <SortHeader
                  label="Customer"
                  sortKey="customer"
                  current={sort}
                  onSort={handleSort}
                  className="col-o-cust"
                />
                <SortHeader
                  label="Placed"
                  sortKey="placed"
                  current={sort}
                  onSort={handleSort}
                  className="col-o-when"
                />
                <th className="col-o-items">Items</th>
                <th className="col-o-ful">Fulfillment</th>
                <SortHeader
                  label="Total"
                  sortKey="total"
                  current={sort}
                  onSort={handleSort}
                  className="col-o-total"
                />
                <th className="col-o-status">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  isOpen={expanded === o.id}
                  onToggle={() => setExpanded(expanded === o.id ? null : o.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
