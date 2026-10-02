import Link from "next/link";
import { club } from "@/club.config";
import { chapterLabel } from "@/lib/chapters";
import type { NoteData } from "@/lib/threads";
import { Head } from "@/components/creatures";
import { WaxSeal } from "@/components/ornaments";

/** A note quoted elsewhere (the desk, a profile): a line or three, linking back to its margin. */
export function Snippet({ note, bookTitle, showBook = true }: { note: NoteData; bookTitle?: string; showBook?: boolean }) {
  const m = club.members[note.member];
  const href = `/books/${note.book_id}/chapter/${note.chapter}#note-${note.id}`;
  const where = (
    <>
      {showBook && bookTitle ? (
        <>
          <i>{bookTitle}</i>,{" "}
        </>
      ) : null}
      {chapterLabel(note.chapter)}
    </>
  );

  if (note.sealed) {
    return (
      <Link href={href} className="group flex items-start gap-3 py-4">
        <WaxSeal className="mt-0.5 h-7 w-7 shrink-0" />
        <div className="min-w-0">
          <p className="text-[1.05rem] italic text-ink-soft">
            A sealed note from <span style={{ fontFamily: m.hand, color: `var(--${note.member})` }} className="not-italic">{m.name}</span>
          </p>
          <p className="mt-0.5 text-sm text-ink-faint">
            {where} · beyond your ribbon · {note.when}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link href={href} className="group block py-4">
      <div className="flex items-center gap-2">
        <Head who={note.member} size={18} />
        <span className="leading-none" style={{ fontFamily: m.hand, color: `var(--${note.member})`, fontSize: note.member === "monkey" ? "1.25rem" : "0.92rem" }}>
          {m.name}
        </span>
        <span className="min-w-0 text-sm leading-snug text-ink-faint">
          on {where} · {note.when}
        </span>
      </div>
      {note.quote && <p className="mt-2 line-clamp-2 pl-[1.6rem] italic text-ink-soft">“{note.quote}”</p>}
      <p className="mt-1.5 line-clamp-3 pl-[1.6rem] text-[1.08rem] leading-snug text-ink transition-colors group-hover:text-wax">{note.body}</p>
    </Link>
  );
}
