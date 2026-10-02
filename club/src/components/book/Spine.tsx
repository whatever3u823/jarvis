import Link from "next/link";
import type { CSSProperties } from "react";
import { clothFor, hash, wobble } from "@/lib/cloth";
import type { Book } from "@/lib/data/types";

/** A book standing on a shelf (or lying in a stack on a phone). */
export function Spine({ book, leaning = false, notes = 0 }: { book: Book; leaning?: boolean; notes?: number }) {
  const { cloth, ink } = clothFor(book.title, book.author);
  const pages = book.total_pages ?? 250;
  const widthRem = Math.min(4.4, Math.max(2.1, 1.7 + pages / 140));
  const heightRem = 13 + wobble(book.id, 1) * 4;
  const bands = hash(book.title) % 3;
  const style = {
    "--spine": cloth,
    "--spine-ink": ink,
    "--w": `${widthRem}rem`,
    "--h": `${heightRem}rem`,
    "--nudge": `${Math.round(wobble(book.id, 2) * 22)}px`,
    "--inset": `${Math.round(wobble(book.id, 3) * 34)}px`,
  } as CSSProperties;

  return (
    <Link
      href={`/books/${book.id}`}
      className={`spine ${leaning ? "leaning" : ""}`}
      style={style}
      title={`${book.title} — ${book.author}${notes ? ` · ${notes} notes` : ""}`}
    >
      <span className="flex min-w-0 flex-col items-start gap-1 md:flex-row md:items-center md:gap-3">
        {bands > 0 && <span className="spine-band hidden md:block" aria-hidden />}
        <span className="spine-title">{book.title}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="spine-author">{book.author.split(" ").slice(-1)[0]}</span>
        {bands > 1 && <span className="spine-band hidden md:block" aria-hidden />}
      </span>
    </Link>
  );
}
