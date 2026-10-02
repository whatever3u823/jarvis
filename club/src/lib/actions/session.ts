"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { isMemberKey } from "@/club.config";
import { LAMP_COOKIE, READER_COOKIE, passphraseMatches, sealReader } from "@/lib/session";
import type { FormState } from "./state";

const YEAR = 60 * 60 * 24 * 365;

export async function enter(_prev: FormState, form: FormData): Promise<FormState> {
  const who = form.get("member");
  if (!isMemberKey(who)) return { ok: false, error: "Choose who you are first." };
  if (!passphraseMatches(String(form.get("passphrase") ?? ""))) {
    return { ok: false, error: "That isn't the word. The cat is watching." };
  }
  (await cookies()).set(READER_COOKIE, sealReader(who), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: YEAR,
    path: "/",
  });
  redirect("/");
}

export async function leave(): Promise<void> {
  (await cookies()).delete(READER_COOKIE);
  redirect("/threshold");
}

export async function toggleLamp(): Promise<void> {
  const jar = await cookies();
  const next = jar.get(LAMP_COOKIE)?.value === "night" ? "day" : "night";
  jar.set(LAMP_COOKIE, next, { sameSite: "lax", maxAge: YEAR, path: "/" });
  refresh();
}
