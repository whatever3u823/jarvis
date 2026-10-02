"use server";

import { revalidatePath } from "next/cache";
import { db, withTransaction } from "@/lib/db";
import { requireReader } from "@/lib/session";
import { fieldErrors, formObject, progressSchema } from "@/lib/validation";
import { getBook } from "@/lib/data/books";
import { todayISO } from "@/lib/format";
import { otherMember } from "@/club.config";
import { chapterLabel } from "@/lib/chapters";
import type { Reading } from "@/lib/data/types";
import type { FormState } from "./state";

export async function updateProgress(_prev: FormState, form: FormData): Promise<FormState> {
  const reader = await requireReader();
  const parsed = progressSchema.safeParse(formObject(form));
  if (!parsed.success) return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] };
  const { book_id, finished } = parsed.data;
  let { chapter, page } = parsed.data;

  const book = await getBook(book_id);
  if (!book) return { ok: false, error: "That book has gone missing from the shelves." };
  if (book.total_chapters && chapter > book.total_chapters) {
    return { ok: false, error: `This book only has ${book.total_chapters} chapters.` };
  }
  if (book.total_pages && page != null && page > book.total_pages) {
    return { ok: false, error: `This book ends at page ${book.total_pages}.` };
  }
  if (finished) {
    chapter = book.total_chapters ?? chapter;
    page = book.total_pages ?? page;
  }
  const today = todayISO();
  const begun = chapter > 0 || (page ?? 0) > 0 || finished;

  await withTransaction(async (c) => {
    const prev = (
      await c.query<Reading>(`select * from readings where book_id = $1 and member = $2 for update`, [book_id, reader])
    ).rows[0];
    const finishedOn = finished ? prev?.finished_on ?? today : null;
    const startedOn = prev?.started_on ?? (begun ? today : null);

    await c.query(
      `insert into readings (book_id, member, chapter, page, started_on, finished_on, updated_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (book_id, member) do update
         set chapter = excluded.chapter, page = excluded.page, started_on = excluded.started_on,
             finished_on = excluded.finished_on, updated_at = now()`,
      [book_id, reader, chapter, page, startedOn, finishedOn],
    );

    const wasBegun = prev && (prev.chapter > 0 || (prev.page ?? 0) > 0 || prev.finished_on);
    const kind =
      finished && !prev?.finished_on ? "finished"
      : begun && !wasBegun ? "began"
      : prev && !finished && (prev.chapter !== chapter || prev.page !== page) ? "progress"
      : null;
    if (kind) {
      await c.query(`insert into reading_events (book_id, member, kind, chapter, page) values ($1, $2, $3, $4, $5)`, [
        book_id, reader, kind, chapter, page,
      ]);
    }

    if (begun && book.status === "want") {
      await c.query(`update books set status = 'reading', started_on = coalesce(started_on, $2), updated_at = now() where id = $1`, [book_id, today]);
    }
    if (finished && (book.status === "reading" || book.status === "want")) {
      const other = (
        await c.query<{ finished_on: string | null }>(`select finished_on from readings where book_id = $1 and member = $2`, [book_id, otherMember(reader)])
      ).rows[0];
      if (other?.finished_on) {
        await c.query(
          `update books set status = 'finished', started_on = coalesce(started_on, $2), finished_on = $2, updated_at = now() where id = $1`,
          [book_id, today],
        );
      }
    }
  });

  revalidatePath("/", "layout");
  return { ok: true, stamp: Date.now(), error: undefined, values: { said: finished ? "Finished. Bravo." : `Bookmark moved to ${chapterLabel(chapter)}.` } };
}

export async function setRating(bookId: number, rating: number | null): Promise<void> {
  const reader = await requireReader();
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new Error("Ratings run from one to five");
  await db().query(
    `insert into readings (book_id, member, rating) values ($1, $2, $3)
     on conflict (book_id, member) do update set rating = excluded.rating, updated_at = now()`,
    [bookId, reader, rating],
  );
  revalidatePath("/", "layout");
}

export async function saveNotes(_prev: FormState, form: FormData): Promise<FormState> {
  const reader = await requireReader();
  const bookId = Number(form.get("book_id"));
  const notes = String(form.get("notes") ?? "").trim();
  if (!Number.isSafeInteger(bookId)) return { ok: false, error: "Unknown book." };
  if (notes.length > 20000) return { ok: false, error: "That's a whole other book. Keep it under 20,000 characters." };
  await db().query(
    `insert into readings (book_id, member, notes) values ($1, $2, $3)
     on conflict (book_id, member) do update set notes = excluded.notes, updated_at = now()`,
    [bookId, reader, notes || null],
  );
  revalidatePath("/", "layout");
  return { ok: true, stamp: Date.now() };
}
