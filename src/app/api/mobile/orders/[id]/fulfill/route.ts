import { NextResponse } from "next/server";

import { bearerSubject } from "@/lib/auth/bearer";
import { fulfillOrder } from "@/lib/admin/order-mutations";

// POST /api/mobile/orders/[id]/fulfill — bearer-guarded. The app's single
// mutation (DEC-050 thin scope): mark the order fulfilled. The terminal status
// (picked_up|delivered) is derived server-side from fulfillment_type, so the
// client sends no status. 404 when the order is gone; 409 when the transition is
// illegal (e.g. a `new` order that was never marked ready).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!bearerSubject(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const result = await fulfillOrder(id);
  if (result.error) {
    const status = result.error === "Order not found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
