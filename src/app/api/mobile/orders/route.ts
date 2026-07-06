import { NextResponse } from "next/server";

import { bearerSubject } from "@/lib/auth/bearer";
import { listActiveOrders } from "@/lib/admin/orders-queries";

// GET /api/mobile/orders — bearer-guarded. The active (non-terminal) order set,
// the same service read the admin Orders page and fulfillment sheet use
// (DEC-041/045) — one source of truth for "what's still open".
export async function GET(req: Request) {
  if (!bearerSubject(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orders = await listActiveOrders();
  return NextResponse.json({ orders });
}
