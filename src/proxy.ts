import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken, createSessionToken, SESSION_TTL_SECONDS } from "@/lib/auth";

// Password gate, re-enabled at the user's request — now covering the
// landing page too (previously excluded, back when this was a
// friction-free public link friends could open straight from a
// message). /login itself still has to stay reachable unauthenticated,
// or nobody could ever get in.
export async function proxy(request: NextRequest) {
  // The downloaded desktop app auto-authenticates instead of showing the
  // password screen — electron/main.js appends this on its one initial
  // loadURL() call (in-app client-side navigation after that never hits
  // this query param again, so the cookie below is what actually keeps
  // it logged in past that first request).
  const desktopKey = request.nextUrl.searchParams.get("desktop_key");
  if (desktopKey && process.env.DESKTOP_APP_SECRET && desktopKey === process.env.DESKTOP_APP_SECRET) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("desktop_key");
    const response = NextResponse.redirect(url);
    response.cookies.set(SESSION_COOKIE, await createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isAuthed = token ? await verifySessionToken(token) : false;
  if (!isAuthed) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  // Gate everything except the login page itself, its server action, and
  // Next.js internals/static assets. The landing page is INTENTIONALLY
  // no longer excluded here — see the module comment above.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|manifest.json).*)"],
};
