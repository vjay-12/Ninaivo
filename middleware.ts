import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "m_routine_session";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "m_routine_fallback_secret_must_be_32_chars_long!!";
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static files, API routes, manifest, images, etc.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  let isAuthenticated = false;

  if (token) {
    try {
      const secretKey = getSecretKey();
      const { payload } = await jwtVerify(token, secretKey);
      isAuthenticated = payload.authenticated === true;
    } catch {
      isAuthenticated = false;
    }
  }

  // Redirect root to /today
  if (pathname === "/") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/today", request.url));
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // If on /login
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/today", request.url));
    }
    return NextResponse.next();
  }

  // Protected pages
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

