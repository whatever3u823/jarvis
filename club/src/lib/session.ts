import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isMemberKey, type MemberKey } from "@/club.config";

/**
 * Who is reading. For now this is a signed cookie chosen at the threshold
 * (optionally behind a shared passphrase). It is the single seam where real
 * authentication will go: everything else asks `getReader()`.
 */

export const READER_COOKIE = "club_reader";
export const LAMP_COOKIE = "club_lamp";

function secret(): string {
  const s = process.env.CLUB_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("CLUB_SECRET must be set (16+ characters) in production.");
  return "dev-only-secret-not-for-production";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function sealReader(key: MemberKey): string {
  return `${key}.${sign(key)}`;
}

export function openReader(token: string | undefined): MemberKey | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  const key = token.slice(0, dot);
  if (!isMemberKey(key)) return null;
  const expected = Buffer.from(sign(key));
  const given = Buffer.from(token.slice(dot + 1));
  return expected.length === given.length && timingSafeEqual(expected, given) ? key : null;
}

export async function getReader(): Promise<MemberKey | null> {
  return openReader((await cookies()).get(READER_COOKIE)?.value);
}

/** For pages and actions: the current reader, or off to the threshold. */
export async function requireReader(): Promise<MemberKey> {
  const reader = await getReader();
  if (!reader) redirect("/threshold");
  return reader;
}

export async function getLamp(): Promise<"day" | "night"> {
  return (await cookies()).get(LAMP_COOKIE)?.value === "night" ? "night" : "day";
}

export function passphraseRequired(): boolean {
  return Boolean(process.env.CLUB_PASSPHRASE);
}

export function passphraseMatches(given: string): boolean {
  const want = process.env.CLUB_PASSPHRASE;
  if (!want) return true;
  const a = Buffer.from(want.trim().toLowerCase());
  const b = Buffer.from(given.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
