import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: no reader cookie, no entry. The cookie's signature
 * is verified where it matters (pages and Server Actions, via lib/session).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("club_reader")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/threshold";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!threshold|_next/|favicon|icon|apple-icon|robots.txt|fonts/).*)"],
};
