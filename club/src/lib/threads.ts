import type { MemberKey } from "@/club.config";
import type { Mark, Note } from "@/lib/data/types";
import { whenSaid, clockTime, longDate } from "@/lib/format";

/** What a client component needs to draw one note: plain data, times already phrased. */
export type NoteData =
  | {
      sealed: false;
      id: number;
      book_id: number;
      member: MemberKey;
      chapter: number;
      body: string;
      quote: string | null;
      page: number | null;
      marks: Mark[];
      when: string;
      stamp: string;
      replies: NoteData[];
    }
  | { sealed: true; id: number; book_id: number; member: MemberKey; chapter: number; when: string; stamp: string; replies: NoteData[] };

function toData(n: Note, now: Date): NoteData {
  const when = whenSaid(n.created_at, now);
  const stamp = `${longDate(n.created_at)}, ${clockTime(n.created_at)}`;
  return n.sealed
    ? { sealed: true, id: n.id, book_id: n.book_id, member: n.member, chapter: n.chapter, when, stamp, replies: [] }
    : {
        sealed: false, id: n.id, book_id: n.book_id, member: n.member, chapter: n.chapter, body: n.body, quote: n.quote,
        page: n.page, marks: n.marks, when, stamp, replies: [],
      };
}

/** Notes grouped into threads (top-level notes with their replies), in reading order. */
export function threads(notes: Note[], now = new Date()): NoteData[] {
  const top: NoteData[] = [];
  const byId = new Map<number, NoteData>();
  const sorted = [...notes].sort((a, b) => +a.created_at - +b.created_at);
  for (const n of sorted) {
    const d = toData(n, now);
    byId.set(n.id, d);
    if (n.reply_to == null) top.push(d);
  }
  for (const n of sorted) {
    if (n.reply_to != null) byId.get(n.reply_to)?.replies.push(byId.get(n.id)!);
  }
  return top;
}

export function noteData(n: Note, now = new Date()): NoteData {
  return toData(n, now);
}
