import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { readSessionToken, SESSION_COOKIE } from "@/lib/auth/token";

const protectedPrefixes = ["/dashboard", "/manage", "/api/app"];

export async function middleware(request: NextRequest) {
  if (!protectedPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await readSessionToken(token);

  if (session) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/manage/:path*", "/api/app/:path*"],
};
