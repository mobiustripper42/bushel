import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { ADMIN_SESSION_COOKIE, sessionSecret } from "@/lib/auth/config";
import {
  CUSTOMER_TOKEN_COOKIE,
  CUSTOMER_TOKEN_COOKIE_MAX_AGE,
  lookupCustomerByToken,
} from "@/lib/customer/session";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Admin gate (DEC-047): verify the self-rolled HMAC session cookie. Pure
  // node:crypto — runs here because Next 16's proxy uses the Node.js runtime.
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const valid = token
      ? verifySession(token, sessionSecret(), new Date()).ok
      : false;
    if (!valid) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set(
        "next",
        request.nextUrl.pathname + request.nextUrl.search,
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  // Token shape: 6+3 alphanumeric with a dash (src/lib/tokens.ts). Min length
  // 8 also covers the longer testtoken-* fixtures; rejects scanner traffic
  // (e.g. /c/wp-admin, /c/.env) before any DB lookup.
  const customerMatch = request.nextUrl.pathname.match(
    /^\/c\/([a-z0-9-]{8,})(?:[/?#]|$)/,
  );
  if (customerMatch) {
    const token = customerMatch[1];
    const customer = await lookupCustomerByToken(token);
    if (customer) {
      response.cookies.set(CUSTOMER_TOKEN_COOKIE, token, {
        httpOnly: true,
        // Gate on actual transport, not NODE_ENV: WebKit refuses Secure cookies
        // on HTTP localhost, which broke CI (`npm start` → NODE_ENV=production).
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        maxAge: CUSTOMER_TOKEN_COOKIE_MAX_AGE,
        path: "/",
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
