import { z } from "zod";
import { AFTERWORD, PRELUDE } from "@/lib/chapters";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable().default(null));
const optionalInt = (min: number, max: number) =>
  z.preprocess(blankToNull, z.coerce.number().int().min(min).max(max).nullable().default(null));
const optionalDate = z.preprocess(
  blankToNull,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a full date").nullable().default(null),
);

export const bookSchema = z
  .object({
    title: z.string().trim().min(1, "Every book has a title").max(300),
    author: z.string().trim().min(1, "Someone wrote it").max(200),
    translator: optionalText(200),
    year_published: optionalInt(-3000, 2100),
    description: optionalText(5000),
    isbn: z.preprocess(
      (v) => (typeof v === "string" ? v.replace(/[^0-9Xx]/g, "").toUpperCase() || null : v),
      z.string().regex(/^(\d{9}[\dX]|\d{13})$/, "That isn't an ISBN-10 or ISBN-13").nullable().default(null),
    ),
    cover_url: z.preprocess(blankToNull, z.url({ protocol: /^https?$/, error: "Paste a full image link (https://…)" }).max(2000).nullable().default(null)),
    total_pages: optionalInt(1, 20000),
    total_chapters: optionalInt(1, 999),
    status: z.enum(["want", "reading", "finished", "abandoned"]).default("want"),
    started_on: optionalDate,
    finished_on: optionalDate,
  })
  .refine((b) => !b.started_on || !b.finished_on || b.started_on <= b.finished_on, {
    path: ["finished_on"],
    message: "It can't end before it began",
  });

export const thoughtSchema = z
  .object({
    book_id: z.coerce.number().int().positive(),
    chapter: z.coerce.number().int().min(PRELUDE).max(AFTERWORD),
    body: z.string().trim().min(1, "The margin is still empty").max(8000),
    quote: optionalText(2000),
    page: optionalInt(1, 20000),
    reply_to: optionalInt(1, Number.MAX_SAFE_INTEGER),
  });

export const progressSchema = z.object({
  book_id: z.coerce.number().int().positive(),
  chapter: z.coerce.number().int().min(0).max(999),
  page: optionalInt(0, 20000),
  finished: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export const goalSchema = z.object({
  book_id: z.coerce.number().int().positive(),
  goal_chapter: optionalInt(1, 999),
  goal_date: optionalDate,
});

/** First message per field, for showing beside inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export function formObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
