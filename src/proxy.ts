import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isAuthed = token ? await verifySessionToken(token) : false;

  if (!isAuthed) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Gate everything except the login page itself, its server action, and
  // Next.js internals/static assets — a matcher that accidentally caught
  // those would block CSS/JS/images from loading on the login screen.
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|manifest.json).*)",
  ],
};
