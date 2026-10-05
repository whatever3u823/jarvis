import { NextResponse } from "next/server";
import { checkPassword, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/auth";
import { appPassword } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const password = appPassword();
  if (!password) return NextResponse.json({ error: "No password is configured." }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const submitted = typeof body?.password === "string" ? body.password : "";
  if (!(await checkPassword(submitted, password))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
