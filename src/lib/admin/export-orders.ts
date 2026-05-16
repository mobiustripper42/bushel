// Wave-compatible export for the admin orders list (Phase 5.2, DEC-016).
// Two formats from the same row shape:
//   - CSV  → file download (RFC 4180 quoting)
//   - TSV  → clipboard paste into Wave's Sheets import
//
// Columns match Wave's Sheets import exactly:
//   Invoice Number | Customer Name | Item Name | Quantity | Unit Price |
//   Description    | Sales Taxes   | Messages
//
// One row per LINE ITEM. Wave bundles rows that share an Invoice Number into
// a single draft invoice — so all of one order's line items share the same
// Invoice Number (we use the first 8 chars of the order UUID, matching what
// the admin list shows as `#xxxxxxxx`). Description carries the unit
// (e.g. "bunch", "lb") because Wave doesn't have a separate unit column —
// putting it in Description keeps the per-line context visible on the
// invoice. Sales Taxes + Messages are intentionally blank (no tax in V1, no
// per-line note channel from the customer order form).

import type { OrderRow } from "@/lib/admin/orders-queries";

export const EXPORT_COLUMNS = [
  "Invoice Number",
  "Customer Name",
  "Item Name",
  "Quantity",
  "Unit Price",
  "Description",
  "Sales Taxes",
  "Messages",
] as const;

type ExportRow = {
  invoiceNumber: string;
  customerName: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
  description: string;
  salesTaxes: string;
  messages: string;
};

// 12 hex chars = 2^48 combinations. With 7 customers × weekly orders, an
// in-export collision is essentially impossible — and the failure mode if
// two rows shared an invoice number is Wave silently merging two customers'
// orders into one invoice. 8 chars (~4B combos) felt fine on paper but
// review flagged the silent-merge risk; 12 is the cheap fix.
function invoiceNumberFor(orderId: string): string {
  return orderId.slice(0, 12);
}

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function ordersToRows(orders: OrderRow[]): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const o of orders) {
    const invoiceNumber = invoiceNumberFor(o.id);
    for (const i of o.items) {
      rows.push({
        invoiceNumber,
        customerName: o.customerName,
        itemName: i.name,
        quantity: String(i.qty),
        unitPrice: money(i.unitPriceCents),
        description: i.unit,
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
    row.invoiceNumber,
    row.customerName,
    row.itemName,
    row.quantity,
    row.unitPrice,
    row.description,
    row.salesTaxes,
    row.messages,
  ];
}

export function toCsv(orders: OrderRow[]): string {
  const lines = [EXPORT_COLUMNS.map(csvEscape).join(",")];
  for (const row of ordersToRows(orders)) {
    lines.push(rowToValues(row).map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}

export function toTsv(orders: OrderRow[]): string {
  const lines = [EXPORT_COLUMNS.map(tsvEscape).join("\t")];
  for (const row of ordersToRows(orders)) {
    lines.push(rowToValues(row).map(tsvEscape).join("\t"));
  }
  return lines.join("\n");
}

export function csvFilename(weekOf: string): string {
  return `bushel-orders-${weekOf}.csv`;
}
