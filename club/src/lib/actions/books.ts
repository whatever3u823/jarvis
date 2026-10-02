"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, withTransaction } from "@/lib/db";
import { requireReader } from "@/lib/session";
import { bookSchema, fieldErrors, formObject, goalSchema } from "@/lib/validation";
import { getBook } from "@/lib/data/books";
import { todayISO } from "@/lib/format";
import type { Status } from "@/lib/data/types";
import type { FormState } from "./state";

const COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const MAX_COVER_BYTES = 3 * 1024 * 1024;

async function readCover(form: FormData): Promise<{ mime: string; data: Buffer } | null | string> {
  const file = form.get("cover_file");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!COVER_TYPES.has(file.type)) return "Covers can be JPEG, PNG, WebP, GIF or AVIF.";
  if (file.size > MAX_COVER_BYTES) return "That cover is over 3 MB; a smaller image will do.";
  return { mime: file.type, data: Buffer.from(await file.arrayBuffer()) };
}

function datesForStatus(status: Status, started: string | null, finished: string | null) {
  const today = todayISO();
  return {
    started_on: status === "reading" || status === "finished" || status === "abandoned" ? started ?? today : started,
    finished_on: status === "finished" ? finished ?? today : status === "want" || status === "reading" ? null : finished,
  };
}

export async function saveBook(_prev: FormState, form: FormData): Promise<FormState> {
  const reader = await requireReader();
  const idRaw = form.get("id");
  const id = idRaw ? Number(idRaw) : null;
  const raw = formObject(form);
  const parsed = bookSchema.safeParse(raw);
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]));
  if (!parsed.success) return { ok: false, error: "A few things need another look.", errors: fieldErrors(parsed.error), values };
  const cover = await readCover(form);
  if (typeof cover === "string") return { ok: false, error: cover, errors: { cover_file: cover }, values };

  const b = parsed.data;
  const dates = datesForStatus(b.status, b.started_on, b.finished_on);
  const columns = [
    b.title, b.author, b.translator, b.year_published, b.description, b.isbn, b.cover_url,
    b.total_pages, b.total_chapters, b.status, dates.started_on, dates.finished_on,
  ];

  const bookId = await withTransaction(async (c) => {
    let bookId: number;
    if (id) {
      const res = await c.query(
        `update books set title=$1, author=$2, translator=$3, year_published=$4, description=$5, isbn=$6, cover_url=$7,
           total_pages=$8, total_chapters=$9, status=$10, started_on=$11, finished_on=$12, updated_at=now()
         where id = $13 returning id`,
        [...columns, id],
      );
      if (res.rowCount === 0) throw new Error("Book not found");
      bookId = id;
    } else {
      const res = await c.query<{ id: number }>(
        `insert into books (title, author, translator, year_published, description, isbn, cover_url,
           total_pages, total_chapters, status, started_on, finished_on, added_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        [...columns, reader],
      );
      bookId = res.rows[0].id;
    }
    if (cover) {
      await c.query(
        `insert into covers (book_id, mime, data) values ($1, $2, $3)
         on conflict (book_id) do update set mime = excluded.mime, data = excluded.data, updated_at = now()`,
        [bookId, cover.mime, cover.data],
      );
    } else if (form.get("remove_cover") === "on") {
      await c.query(`delete from covers where book_id = $1`, [bookId]);
    }
    return bookId;
  });

  revalidatePath("/", "layout");
  redirect(`/books/${bookId}`);
}

export async function setStatus(bookId: number, status: Status): Promise<void> {
  await requireReader();
  const book = await getBook(bookId);
  if (!book) throw new Error("Book not found");
  const dates = datesForStatus(status, book.started_on, book.finished_on);
  await db().query(`update books set status=$1, started_on=$2, finished_on=$3, updated_at=now() where id=$4`, [
    status, dates.started_on, dates.finished_on, bookId,
  ]);
  revalidatePath("/", "layout");
}

export async function setGoal(_prev: FormState, form: FormData): Promise<FormState> {
  await requireReader();
  const parsed = goalSchema.safeParse(formObject(form));
  if (!parsed.success) return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] };
  const g = parsed.data;
  await db().query(`update books set goal_chapter=$1, goal_date=$2, updated_at=now() where id=$3`, [g.goal_chapter, g.goal_date, g.book_id]);
  revalidatePath("/", "layout");
  return { ok: true, stamp: Date.now() };
}

export async function deleteBook(bookId: number): Promise<void> {
  await requireReader();
  await db().query(`delete from books where id = $1`, [bookId]);
  revalidatePath("/", "layout");
  redirect("/library");
}
