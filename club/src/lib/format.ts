import { club } from "@/club.config";

const tz = club.timezone;

function parts(date: Date): { y: number; m: number; d: number; h: number; weekday: string } {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23", weekday: "long",
  });
  const out: Record<string, string> = {};
  for (const p of f.formatToParts(date)) out[p.type] = p.value;
  return { y: +out.year, m: +out.month, d: +out.day, h: +out.hour, weekday: out.weekday };
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  // Plain dates are calendar days; anchor them at noon so no zone moves them.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
}

/** "14 November 2025" */
export function longDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "long", year: "numeric" }).format(toDate(value));
}

/** "14 Nov" (year added when it isn't this year) */
export function shortDate(value: Date | string, now = new Date()): string {
  const d = toDate(value);
  const sameYear = parts(d).y === parts(now).y;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
}

/** "14.XI.2025", the way an archivist would pencil it. */
export function archivalDate(value: Date | string): string {
  const p = parts(toDate(value));
  const months = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return `${p.d}.${months[p.m - 1]}.${p.y}`;
}

export function clockTime(value: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(toDate(value));
}

function partOfDay(h: number): string {
  if (h < 5) return "in the small hours";
  if (h < 12) return "in the morning";
  if (h < 18) return "in the afternoon";
  if (h < 22) return "in the evening";
  return "late at night";
}

function dayNumber(p: { y: number; m: number; d: number }): number {
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000);
}

/** Time the way a person would say it: "this evening", "yesterday, late at night", "on Tuesday". */
export function whenSaid(value: Date | string, now = new Date()): string {
  const d = toDate(value);
  const seconds = (now.getTime() - d.getTime()) / 1000;
  if (seconds < 90) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes ago`;
  const a = parts(d);
  const b = parts(now);
  const days = dayNumber(b) - dayNumber(a);
  if (days === 0) {
    if (a.h < 5) return "tonight, in the small hours";
    if (a.h < 12) return "this morning";
    if (a.h < 18) return "this afternoon";
    if (a.h < 22) return "this evening";
    return "tonight";
  }
  if (days === 1) return `yesterday, ${partOfDay(a.h)}`;
  if (days < 7) return `on ${a.weekday}`;
  return shortDate(d, now);
}

export function daysBetween(from: Date | string, to: Date | string): number {
  return dayNumber(parts(toDate(to))) - dayNumber(parts(toDate(from)));
}

export function todayISO(now = new Date()): string {
  const p = parts(now);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function hourNow(now = new Date()): number {
  return parts(now).h;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** Small numbers in words, the rest in figures. */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n < WORDS.length ? WORDS[n] : n} ${n === 1 ? one : many}`;
}

export function accession(id: number): string {
  return `No. ${String(id).padStart(3, "0")}`;
}
