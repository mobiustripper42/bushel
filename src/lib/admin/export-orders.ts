// Wave-compatible export for the admin orders list (Phase 5.2, DEC-016).
// Two formats from the same row shape:
//   - CSV  → file download (RFC 4180 quoting)
//   - TSV  → clipboard paste into Wave's Sheets import
//
// Columns match Wave's Sheets import exactly (7 cols, no Invoice Number —
// Wave assigns the invoice number itself when the sheet is imported):
//   Customer Name | Item Number | Quantity | Unit Price | Description |
//   Sales Taxes  | Messages
//
// HEADER ROW IS INTENTIONALLY OMITTED. Wave's import flow expects raw data
// rows; Annabel's sheet template already labels the columns. Emitting a
// header would import as a phantom invoice for a customer named
// "Customer Name." EXPORT_COLUMNS stays exported for documentation +
// test assertions.
//
// One row per LINE ITEM. Per-product mapping:
//   Wave "Item Number" ← products.description (used as a slug, e.g.
//     "KALE-BUNCH" — Annabel populates this in the inventory editor).
//     Empty cell when the slug isn't set; she fills it in Wave before
//     posting.
//   Wave "Description" ← products.name (the human-readable product name).
//   products.unit is no longer in the export; it lives in the customer-
//     facing UI and the admin row detail, not the invoice.
//
// Sales Taxes + Messages are intentionally blank (no tax in V1, no per-line
// note channel from the customer order form).

import type { OrderRow } from "@/lib/admin/orders-queries";

export const EXPORT_COLUMNS = [
  "Customer Name",
  "Item Number",
  "Quantity",
  "Unit Price",
  "Description",
  "Sales Taxes",
  "Messages",
] as const;

type ExportRow = {
  customerName: string;
  itemNumber: string;
  quantity: string;
  unitPrice: string;
  description: string;
  salesTaxes: string;
  messages: string;
};

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function ordersToRows(orders: OrderRow[]): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const o of orders) {
    for (const i of o.items) {
      rows.push({
        customerName: o.customerName,
        itemNumber: i.description ?? "",
        quantity: String(i.qty),
        unitPrice: money(i.unitPriceCents),
        description: i.name,
        salesTaxes: "",
        messages: "",
      });
    }
  }
  return rows;
}

// RFC 4180: quote if the field contains a comma, double-quote, or newline.
// Double internal quotes by doubling them.
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// TSV: tab-separated, no field quoting in the typical paste-to-Sheets flow.
// Tabs and newlines inside fields would break the row shape — strip them.
// Bushel product names are short and operator-entered; no tabs expected.
function tsvEscape(value: string): string {
  return value.replace(/[\t\n\r]+/g, " ");
}

function rowToValues(row: ExportRow): string[] {
  return [
    row.customerName,
    row.itemNumber,
    row.quantity,
    row.unitPrice,
    row.description,
    row.salesTaxes,
    row.messages,
  ];
}

export function toCsv(orders: OrderRow[]): string {
  return ordersToRows(orders)
    .map((row) => rowToValues(row).map(csvEscape).join(","))
    .join("\r\n");
}

export function toTsv(orders: OrderRow[]): string {
  return ordersToRows(orders)
    .map((row) => rowToValues(row).map(tsvEscape).join("\t"))
    .join("\n");
}

export function csvFilename(weekOf: string): string {
  return `bushel-orders-${weekOf}.csv`;
}
