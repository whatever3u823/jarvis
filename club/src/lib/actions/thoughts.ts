"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireReader } from "@/lib/session";
import { fieldErrors, formObject, thoughtSchema } from "@/lib/validation";
import { getBook } from "@/lib/data/books";
import { getThought } from "@/lib/data/thoughts";
import { isValidSection } from "@/lib/chapters";
import { MARK_KINDS, type MarkKind } from "@/lib/data/types";
import type { FormState } from "./state";

export async function addThought(_prev: FormState, form: FormData): Promise<FormState> {
  const reader = await requireReader();
  const raw = formObject(form);
  const parsed = thoughtSchema.safeParse(raw);
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), error: Object.values(fieldErrors(parsed.error))[0], values };
  const t = parsed.data;

  const book = await getBook(t.book_id);
  if (!book) return { ok: false, error: "That book has gone missing from the shelves.", values };
  let chapter = t.chapter;
  if (t.reply_to) {
    // A reply lives beside its note, in the same chapter (and behind the same seal).
    const parent = await getThought(t.reply_to);
    if (!parent || parent.book_id !== book.id) return { ok: false, error: "That note has been erased.", values };
    chapter = parent.chapter;
  } else if (!isValidSection(chapter, book.total_chapters)) {
    return { ok: false, error: "That chapter isn't in this book.", values };
  }

  await db().query(
    `insert into thoughts (book_id, member, chapter, body, quote, page, reply_to) values ($1, $2, $3, $4, $5, $6, $7)`,
    [book.id, reader, chapter, t.body, t.reply_to ? null : t.quote, t.reply_to ? null : t.page, t.reply_to],
  );
  revalidatePath("/", "layout");
  return { ok: true, stamp: Date.now() };
}

export async function editThought(_prev: FormState, form: FormData): Promise<FormState> {
  const reader = await requireReader();
  const id = Number(form.get("id"));
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { ok: false, error: "The margin is still empty." };
  if (body.length > 8000) return { ok: false, error: "That note is too long for any margin." };
  const res = await db().query(`update thoughts set body = $1, updated_at = now() where id = $2 and member = $3`, [body, id, reader]);
  if (res.rowCount === 0) return { ok: false, error: "Only the hand that wrote a note may change it." };
  revalidatePath("/", "layout");
  return { ok: true, stamp: Date.now() };
}

export async function eraseThought(id: number): Promise<void> {
  const reader = await requireReader();
  await db().query(`delete from thoughts where id = $1 and member = $2`, [id, reader]);
  revalidatePath("/", "layout");
}

export async function toggleMark(thoughtId: number, mark: MarkKind): Promise<void> {
  const reader = await requireReader();
  if (!MARK_KINDS.includes(mark)) throw new Error("Unknown mark");
  const removed = await db().query(`delete from marks where thought_id = $1 and member = $2 and mark = $3`, [thoughtId, reader, mark]);
  if (removed.rowCount === 0) {
    await db().query(`insert into marks (thought_id, member, mark) values ($1, $2, $3) on conflict do nothing`, [thoughtId, reader, mark]);
  }
  revalidatePath("/", "layout");
}

/** Deliberately open the notes of a chapter beyond your bookmark. It is remembered, and noticed. */
export async function breakSeal(bookId: number, chapter: number): Promise<void> {
  const reader = await requireReader();
  const res = await db().query(
    `insert into seals (book_id, member, chapter) values ($1, $2, $3) on conflict do nothing`,
    [bookId, reader, chapter],
  );
  if (res.rowCount) {
    await db().query(`insert into reading_events (book_id, member, kind, chapter) values ($1, $2, 'seal', $3)`, [bookId, reader, chapter]);
  }
  revalidatePath("/", "layout");
}
