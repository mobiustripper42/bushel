/**
 * /api/mobile/* route integration (Phase 11.1). Drives the route handlers
 * directly (construct a Request, call the exported GET/POST) against docker
 * Postgres — the bearer guard, the auth token round-trip, the fulfill mutation,
 * and the push-token upsert, end to end. The pure header-parsing branches live
 * in src/lib/auth/bearer.test.ts; this file proves the wiring and the DB writes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { hashCode } from "@/lib/auth/login-code";
import { makeSession, signSession, type Subject } from "@/lib/auth/session";
import { SESSION_TTL_MS } from "@/lib/auth/config";
import { canConnect, closePool, migrateTestDb, resetData } from "./helpers";

// Pin the signing secret so the routes' bearerSubject and the tokens we mint
// below agree. Set before any route module reads sessionSecret() (it resolves
// lazily per call, so an assignment here is enough).
const SECRET = "mobile-api-test-secret";
process.env.SESSION_SECRET = SECRET;

const ADMIN_ID = "a0000000-0000-0000-0000-0000000000a1";
const ADMIN_EMAIL = "mobile.api@bushel.test";
const SUBJECT: Subject = { kind: "admin", id: ADMIN_ID };

function bearerToken(): string {
  return signSession(makeSession(SUBJECT, new Date(), SESSION_TTL_MS), SECRET);
}

function post(url: string, body: unknown, token?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

function get(url: string, token?: string): Request {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(url, { headers });
}

async function insertCustomer(name: string): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into customers (name, token) values ($1, $2) returning id::text as id`,
    [name, `tok-${name}`],
  );
  return rows[0].id;
}

async function insertOrder(
  customerId: string,
  status: string,
  fulfillmentType: "pickup" | "delivery" = "pickup",
): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into orders (customer_id, week_of, fulfillment_type, status)
     values ($1, current_date, $2, $3) returning id::text as id`,
    [customerId, fulfillmentType, status],
  );
  return rows[0].id;
}

const d = (await canConnect()) ? describe : describe.skip;

d("/api/mobile/* (pg-integration)", () => {
  beforeAll(async () => {
    await migrateTestDb();
    await query(
      `insert into admins (id, email, name) values ($1, $2, 'Mobile API Test')
       on conflict (email) do update
         set id = excluded.id, name = excluded.name, is_active = true`,
      [ADMIN_ID, ADMIN_EMAIL],
    );
  });
  afterAll(closePool);
  beforeEach(resetData); // clears customers/orders/login_codes/push_tokens; admins persist

  describe("auth/request-code", () => {
    it("400s on invalid JSON", async () => {
      const { POST } = await import("@/app/api/mobile/auth/request-code/route");
      const req = new Request("http://t/api/mobile/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns ok and mints no code for a non-admin email (no-enumeration)", async () => {
      const { POST } = await import("@/app/api/mobile/auth/request-code/route");
      // A non-matching email takes the `skip` path — same 200, and it never
      // enters the send branch, so no code row is written.
      const res = await POST(
        post("http://t/api/mobile/auth/request-code", { email: "stranger@nope.test" }),
      );
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
      const rows = await query(`select 1 from login_codes`);
      expect(rows).toHaveLength(0);
    });
  });

  describe("auth/verify-code", () => {
    it("returns a bearer token that a guarded route accepts", async () => {
      const { POST } = await import("@/app/api/mobile/auth/verify-code/route");
      const { GET } = await import("@/app/api/mobile/orders/route");

      // Seed a live code for the admin (only the hash is ever stored).
      await query(
        `insert into login_codes
           (subject_kind, subject_id, code_hash, created_at, expires_at, attempts, consumed_at)
         values ('admin', $1, $2, now(), now() + interval '10 minutes', 0, null)`,
        [ADMIN_ID, hashCode("246813")],
      );

      const res = await POST(
        post("http://t/api/mobile/auth/verify-code", {
          email: ADMIN_EMAIL,
          code: "246813",
        }),
      );
      expect(res.status).toBe(200);
      const { token, expiresAt } = (await res.json()) as {
        token: string;
        expiresAt: string;
      };
      expect(typeof token).toBe("string");
      expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());

      // Round-trip: the returned token authenticates a guarded route.
      const guarded = await GET(get("http://t/api/mobile/orders", token));
      expect(guarded.status).toBe(200);
    });

    it("401s a wrong code without minting a token", async () => {
      const { POST } = await import("@/app/api/mobile/auth/verify-code/route");
      await query(
        `insert into login_codes
           (subject_kind, subject_id, code_hash, created_at, expires_at, attempts, consumed_at)
         values ('admin', $1, $2, now(), now() + interval '10 minutes', 0, null)`,
        [ADMIN_ID, hashCode("111111")],
      );
      const res = await POST(
        post("http://t/api/mobile/auth/verify-code", {
          email: ADMIN_EMAIL,
          code: "999999",
        }),
      );
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe("invalid");
    });
  });

  describe("orders (bearer guard)", () => {
    it("401s without a token", async () => {
      const { GET } = await import("@/app/api/mobile/orders/route");
      const res = await GET(get("http://t/api/mobile/orders"));
      expect(res.status).toBe(401);
    });

    it("returns the active order set with a valid token", async () => {
      const { GET } = await import("@/app/api/mobile/orders/route");
      const customer = await insertCustomer("active-co");
      const orderId = await insertOrder(customer, "ready");

      const res = await GET(get("http://t/api/mobile/orders", bearerToken()));
      expect(res.status).toBe(200);
      const { orders } = (await res.json()) as { orders: Array<{ id: string; status: string }> };
      expect(orders.map((o) => o.id)).toContain(orderId);
      // Terminal orders must not appear.
      const done = await insertCustomer("done-co");
      await insertOrder(done, "picked_up");
      const res2 = await GET(get("http://t/api/mobile/orders", bearerToken()));
      const { orders: o2 } = (await res2.json()) as { orders: Array<{ status: string }> };
      expect(o2.every((o) => o.status !== "picked_up")).toBe(true);
    });
  });

  describe("orders/[id]/fulfill", () => {
    const call = async (id: string, token?: string) => {
      const { POST } = await import("@/app/api/mobile/orders/[id]/fulfill/route");
      return POST(post(`http://t/api/mobile/orders/${id}/fulfill`, {}, token), {
        params: Promise.resolve({ id }),
      });
    };

    it("401s without a token", async () => {
      const res = await call("11111111-1111-1111-1111-111111111111");
      expect(res.status).toBe(401);
    });

    it("advances a ready pickup order to picked_up", async () => {
      const customer = await insertCustomer("fulfill-pickup");
      const orderId = await insertOrder(customer, "ready", "pickup");
      const res = await call(orderId, bearerToken());
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
      const [{ status }] = await query<{ status: string }>(
        `select status from orders where id = $1`,
        [orderId],
      );
      expect(status).toBe("picked_up");
    });

    it("advances a ready delivery order to delivered", async () => {
      const customer = await insertCustomer("fulfill-delivery");
      const orderId = await insertOrder(customer, "ready", "delivery");
      const res = await call(orderId, bearerToken());
      expect(res.status).toBe(200);
      const [{ status }] = await query<{ status: string }>(
        `select status from orders where id = $1`,
        [orderId],
      );
      expect(status).toBe("delivered");
    });

    it("404s an unknown order", async () => {
      const res = await call("22222222-2222-2222-2222-222222222222", bearerToken());
      expect(res.status).toBe(404);
    });

    it("409s an illegal transition (already terminal)", async () => {
      const customer = await insertCustomer("already-done");
      const orderId = await insertOrder(customer, "picked_up", "pickup");
      const res = await call(orderId, bearerToken());
      expect(res.status).toBe(409);
    });
  });

  describe("push-tokens", () => {
    const register = async (body: unknown, token?: string) => {
      const { POST } = await import("@/app/api/mobile/push-tokens/route");
      return POST(post("http://t/api/mobile/push-tokens", body, token));
    };

    it("401s without a token", async () => {
      const res = await register({ token: "ExponentPushToken[x]", platform: "android" });
      expect(res.status).toBe(401);
    });

    it("400s a missing/invalid platform", async () => {
      const res = await register({ token: "ExponentPushToken[x]" }, bearerToken());
      expect(res.status).toBe(400);
    });

    it("registers a token to the authenticated admin", async () => {
      const res = await register(
        { token: "ExponentPushToken[abc]", platform: "android" },
        bearerToken(),
      );
      expect(res.status).toBe(200);
      const rows = await query<{ admin_id: string; platform: string }>(
        `select admin_id::text as admin_id, platform from push_tokens where expo_push_token = $1`,
        ["ExponentPushToken[abc]"],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].admin_id).toBe(ADMIN_ID);
      expect(rows[0].platform).toBe("android");
    });

    it("upserts on re-registration (one row per token, platform updated)", async () => {
      await register({ token: "ExponentPushToken[dup]", platform: "android" }, bearerToken());
      await register({ token: "ExponentPushToken[dup]", platform: "ios" }, bearerToken());
      const rows = await query<{ platform: string }>(
        `select platform from push_tokens where expo_push_token = $1`,
        ["ExponentPushToken[dup]"],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].platform).toBe("ios");
    });
  });
});
