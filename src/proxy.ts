import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The password gate is switched off for now at the user's request (still
// mid-development, wanted friction-free access while iterating). Nothing
// about the auth system was removed — /login, the session-cookie
// machinery in lib/auth.ts (SESSION_COOKIE, verifySessionToken), and
// this check are all still here, just short-circuited. To turn it back
// on, re-import those two and restore the check:
//
//   const token = request.cookies.get(SESSION_COOKIE)?.value;
//   const isAuthed = token ? await verifySessionToken(token) : false;
//   if (!isAuthed) return NextResponse.redirect(new URL("/login", request.url));
//
export async function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Gate everything except the login page itself, its server action, and
  // Next.js internals/static assets.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|manifest.json).*)"],
};
