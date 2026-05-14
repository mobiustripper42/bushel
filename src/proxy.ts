import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  CUSTOMER_TOKEN_COOKIE,
  CUSTOMER_TOKEN_COOKIE_MAX_AGE,
  lookupCustomerByToken,
} from "@/lib/customer/session";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (request.nextUrl.pathname.startsWith("/admin") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(loginUrl);
  }

  const customerMatch = request.nextUrl.pathname.match(/^\/c\/([^/]+)/);
  if (customerMatch) {
    const token = customerMatch[1];
    const customer = await lookupCustomerByToken(token);
    if (customer) {
      response.cookies.set(CUSTOMER_TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
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
