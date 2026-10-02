import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { member, MEMBER_KEYS, otherMember } from "@/club.config";
import { requireReader } from "@/lib/session";
import { bookView } from "@/lib/data/view";
import { getBook } from "@/lib/data/books";
import { threads } from "@/lib/threads";
import { AFTERWORD, PRELUDE, chapterGloss, chapterLabel, isValidSection, roman, sections } from "@/lib/chapters";
import { count } from "@/lib/format";
import { positions } from "@/components/book/Ribbons";
import { Marginal } from "@/components/notes/Marginal";
import { Composer } from "@/components/notes/Composer";
import { Seal } from "@/components/notes/Seal";
import { Cat, Head, Monkey } from "@/components/creatures";
import { Fleuron } from "@/components/ornaments";

type Props = { params: Promise<{ id: string; n: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, n } = await params;
  const book = await getBook(Number(id));
  return { title: book ? `${chapterLabel(Number(n))} · ${book.title}` : "Not on any shelf" };
}

export default async function ChapterPage({ params }: Props) {
  const reader = await requireReader();
  const { id, n } = await params;
  const chapter = Number(n);
  const view = await bookView(Number(id), reader);
  if (!view || !Number.isInteger(chapter) || !isValidSection(chapter, view.book.total_chapters)) notFound();
  const { book, readings, notes } = view;

  const here = notes.filter((x) => x.chapter === chapter);
  const sealed = here.filter((x) => x.sealed);
  const list = threads(here);
  const all = sections(book.total_chapters);
  const idx = all.indexOf(chapter);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;
  const pos = positions(book, readings);
  const other = otherMember(reader);
  const isBig = chapter !== PRELUDE && chapter !== AFTERWORD;
  const brokeIt = view.broken.has(chapter) && here.some((x) => x.member === other);

  return (
    <article className="pt-8 md:pt-12">
      <nav className="flex items-center justify-between gap-4 text-[1rem]" aria-label="Chapters">
        <Link href={`/books/${book.id}#contents`} className="min-w-0 truncate italic text-ink-soft hover:text-ink">
          ← <span className="font-display not-italic">{book.title}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-4">
          {prev != null ? (
            <Link href={`/books/${book.id}/chapter/${prev}`} className="italic text-ink-faint hover:text-ink" rel="prev">
              ‹ {prev === PRELUDE ? "prelude" : prev === AFTERWORD ? "afterword" : roman(prev)}
            </Link>
          ) : null}
          {next != null ? (
            <Link href={`/books/${book.id}/chapter/${next}`} className="italic text-ink-faint hover:text-ink" rel="next">
              {next === AFTERWORD ? "afterword" : roman(next)} ›
            </Link>
          ) : null}
        </div>
      </nav>

      <header className="mt-10 text-center">
        <div className="label">{isBig ? "Chapter" : "Marginalia"}</div>
        <h1 className="mt-2 font-display leading-none">
          {isBig ? (
            <span className="text-[5.5rem] sm:text-[7.5rem]">{roman(chapter)}</span>
          ) : (
            <span className="text-6xl italic sm:text-7xl">{chapterLabel(chapter)}</span>
          )}
          <span className="sr-only"> — {book.title}</span>
        </h1>
        {chapterGloss(chapter) && <p className="mt-3 text-lg italic text-ink-soft">{chapterGloss(chapter)}</p>}
        <div className="mx-auto mt-6 flex w-fit items-center gap-5 text-[0.98rem] text-ink-soft">
          {MEMBER_KEYS.map((k) => {
            const p = pos[k];
            const where = p.finished || p.chapter > chapter ? "past it" : p.chapter === chapter && p.begun ? "here now" : p.begun ? `${count(chapter - p.chapter, "chapter")} short` : "not yet begun";
            return (
              <span key={k} className="flex items-center gap-1.5">
                <Head who={k} size={16} /> <span>{k === reader ? "you" : member(k).name}:</span>
                <span className="italic">{chapter === PRELUDE ? "—" : where}</span>
              </span>
            );
          })}
        </div>
        <Fleuron width={30} height={18} className="mx-auto mt-6 text-ink-faint" />
      </header>

      <div className="mx-auto mt-10 max-w-4xl">
        {sealed.length > 0 ? (
          <section className="mx-auto max-w-md py-10 text-center" aria-labelledby="sealed-h">
            <h2 id="sealed-h" className="font-display text-3xl">Under seal</h2>
            <p className="mt-3 text-lg leading-relaxed text-ink-soft">
              {member(other).name} left {count(sealed.length, "note")} in the margins of {chapter === AFTERWORD ? "the afterword" : chapterLabel(chapter)}, which is beyond your
              ribbon. Read on first, or break the seal and know.
            </p>
            <div className="mt-10">
              <Seal bookId={book.id} chapter={chapter}>
                Press and hold the seal to break it. {member(other).name} will see that you did.
              </Seal>
            </div>
          </section>
        ) : (
          <>
            {brokeIt && (
              <p className="mb-8 text-center text-sm italic text-ink-faint">You broke the seal on this chapter. It’s in the timeline, for posterity.</p>
            )}
            {list.length > 0 ? (
              <div className="space-y-12">
                {list.map((t) => (t.sealed ? null : <Marginal key={t.id} note={t} reader={reader} />))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                {reader === "monkey" ? <Cat pose="sit" width={44} className="-scale-x-100 text-cat opacity-80" /> : <Monkey pose="read" width={48} className="text-monkey opacity-80" />}
                <p className="mt-4 max-w-sm text-lg italic text-ink-soft">
                  {chapter === PRELUDE
                    ? "No expectations recorded. Brave."
                    : chapter === AFTERWORD
                      ? "Nothing said yet about how it all ended. Someone should have the last word."
                      : "These margins are empty. Either nothing happened in this chapter, or nobody has dared."}
                </p>
              </div>
            )}
            <div className="mt-14 border-t border-rule pt-8">
              <Composer bookId={book.id} reader={reader} chapter={chapter} otherHorizon={view.horizons[other]} />
            </div>
          </>
        )}
      </div>
    </article>
  );
}
