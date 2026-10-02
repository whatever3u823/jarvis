import type { MemberKey } from "@/club.config";
import type { Note, Readings, Thought } from "@/lib/data/types";

/**
 * The spoiler rule. A note is sealed for a reader when someone else wrote it
 * about a part of the book beyond the reader's bookmark, and the reader has
 * not deliberately broken that chapter's seal. Your own notes are never sealed;
 * the prelude never is; the afterword is until you finish.
 */

export interface Bookmark {
  chapter: number;
  finished: boolean;
}

/** The furthest section a reader may see without breaking a seal. */
export function horizon(bookmark: Bookmark | null | undefined): number {
  if (!bookmark) return 0;
  return bookmark.finished ? Number.POSITIVE_INFINITY : bookmark.chapter;
}

export function isSealed(
  note: { member: MemberKey; chapter: number },
  reader: MemberKey,
  readerHorizon: number,
  brokenSeals: ReadonlySet<number>,
): boolean {
  if (note.member === reader) return false;
  if (note.chapter <= readerHorizon) return false;
  return !brokenSeals.has(note.chapter);
}

/**
 * Turn raw thoughts into what `reader` may see. Sealed notes lose their text
 * here, on the server, so nothing beyond your bookmark ever reaches the page
 * until you choose to break the seal.
 */
export function redact(
  thoughts: Thought[],
  reader: MemberKey,
  readingsByBook: Map<number, Readings>,
  sealsByBook: Map<number, Set<number>>,
): Note[] {
  return thoughts.map((t) => {
    const reading = readingsByBook.get(t.book_id)?.[reader];
    const h = horizon(reading ? { chapter: reading.chapter, finished: reading.finished_on != null } : null);
    const sealed = isSealed(t, reader, h, sealsByBook.get(t.book_id) ?? new Set());
    if (!sealed) return { ...t, sealed: false as const };
    return { sealed: true as const, id: t.id, book_id: t.book_id, member: t.member, chapter: t.chapter, reply_to: t.reply_to, created_at: t.created_at };
  });
}

