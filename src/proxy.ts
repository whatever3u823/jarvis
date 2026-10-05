import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/auth";

/**
 * Password gate. With APP_PASSWORD set, every page and API route needs a valid
 * session cookie (from /login). A public Vercel deployment without a password
 * is kept locked: pages show the setup screen, API routes refuse.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const headers = new Headers(req.headers);
  headers.set("x-jarvis-path", pathname);
  const pass = () => NextResponse.next({ request: { headers } });

  const password = process.env.APP_PASSWORD;
  const isApi = pathname.startsWith("/api/");

  if (!password) {
    if (process.env.VERCEL && isApi) {
      return NextResponse.json({ error: "Locked: set APP_PASSWORD for this deployment." }, { status: 503 });
    }
    return pass();
  }
  if (pathname === "/login" || pathname === "/api/login") return pass();
  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value, password)) return pass();

  if (isApi) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except static build assets and the pdf.js worker.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|pdf.worker.min.mjs).*)"],
};
