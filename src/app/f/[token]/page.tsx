import { notFound } from "next/navigation";

import { FulfillmentReportView } from "@/components/fulfillment/fulfillment-report";
import { isValidFulfillmentToken } from "@/lib/fulfillment/link";
import { buildFulfillmentReport } from "@/lib/fulfillment/report";
import { weekOfLabel, weekOfMondayNY } from "@/lib/week";

export const metadata = { title: "Harvest & Pack Sheet — Bay Branch Farm" };

// Always reflect the live data — never serve a cached snapshot, so resolving a
// Tuesday-night oversell moves the totals and slips immediately.
export const dynamic = "force-dynamic";

export default async function FulfillmentReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!(await isValidFulfillmentToken(token))) notFound();

  const report = await buildFulfillmentReport(weekOfMondayNY());

  return <FulfillmentReportView report={report} weekLabel={weekOfLabel()} />;
}
