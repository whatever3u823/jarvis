import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { club, member, MEMBER_KEYS, type MemberKey } from "@/club.config";
import { requireReader } from "@/lib/session";
import { bookView } from "@/lib/data/view";
import { getBook } from "@/lib/data/books";
import { favourites } from "@/lib/data/thoughts";
import { coverSrc } from "@/lib/covers";
import { threads, noteData } from "@/lib/threads";
import { accession, archivalDate, daysBetween, longDate, plural, whenSaid } from "@/lib/format";
import { AFTERWORD, PRELUDE, chapterLabel, chapterShort, sections } from "@/lib/chapters";
import type { Book, Note, ReadingEvent } from "@/lib/data/types";
import { Cover } from "@/components/book/Cover";
import { Ribbons, positions } from "@/components/book/Ribbons";
import { Verdict } from "@/components/book/Verdict";
import { Rating } from "@/components/book/Rating";
import { MemberNotes } from "@/components/book/MemberNotes";
import { DeleteBook, StatusControl } from "@/components/book/BookControls";
import { BookmarkForm } from "@/components/progress/BookmarkForm";
import { GoalForm } from "@/components/progress/GoalForm";
import { Composer } from "@/components/notes/Composer";
import { Snippet } from "@/components/notes/Snippet";
import { Head } from "@/components/creatures";
import { Eternity, OrnamentRule, WaxSeal } from "@/components/ornaments";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = await getBook(Number((await params).id));
  return { title: book?.title ?? "Not on any shelf" };
}

export default async function BookPage({ params }: Props) {
  const reader = await requireReader();
  const view = await bookView(Number((await params).id), reader);
  if (!view) notFound();
  const { book, readings, notes, events } = view;
  const pos = positions(book, readings);
  const mine = readings[reader];
  const other: MemberKey = reader === "monkey" ? "cat" : "monkey";
  const active = book.status === "reading" || book.status === "want";
  const anyoneBegun = pos.monkey.begun || pos.cat.begun;
  const favs = favourites(notes).slice(0, 4);
  const quotes = notes.filter((n) => !n.sealed && n.quote && n.reply_to == null);
  const ratings = MEMBER_KEYS.map((k) => readings[k]?.rating ?? null);
  const divided = ratings[0] != null && ratings[1] != null && Math.abs(ratings[0] - ratings[1]) >= 2;
  const unanimous = ratings[0] === 5 && ratings[1] === 5;
  const latest = threads(notes.filter((n) => n.reply_to == null)).slice(-3).reverse();

  return (
    <article className="pt-8 md:pt-12">
      {/* ——— the dossier's cover sheet ——— */}
      <header className="grid grid-cols-[minmax(0,1fr)] gap-x-14 gap-y-10 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="relative mx-auto self-start md:mx-0">
          <Cover title={book.title} author={book.author} src={coverSrc(book)} size="lg" tilt={-1} />
          <StatusStamp book={book} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="label">Dossier</span>
            <span className="typed text-[0.72rem] text-ink-faint">{accession(book.id)}</span>
            <Link href={`/books/${book.id}/edit`} className="ml-auto text-sm italic text-ink-faint hover:text-ink">
              amend the record
            </Link>
          </div>
          <h1 className="mt-3 font-display text-[2.5rem] leading-[1] text-balance sm:text-6xl">{book.title}</h1>
          <p className="mt-3 text-xl italic text-ink-soft">
            {book.author}
            {book.year_published ? <span className="not-italic text-ink-faint"> · {book.year_published}</span> : null}
          </p>
          {book.translator && <p className="mt-1 text-[1.02rem] italic text-ink-faint">translated by {book.translator}</p>}

          <dl className="typed mt-7 grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[0.82rem]">
            <Fact term="Length">
              {[book.total_pages && plural(book.total_pages, "page"), book.total_chapters && plural(book.total_chapters, "chapter")].filter(Boolean).join(", ") || "—"}
            </Fact>
            {book.isbn && <Fact term="ISBN">{book.isbn}</Fact>}
            <Fact term="Accessioned">
              {archivalDate(book.created_at)}, by the {book.added_by}
            </Fact>
            {book.started_on && <Fact term="Begun">{archivalDate(book.started_on)}</Fact>}
            {book.finished_on && (
              <Fact term={book.status === "abandoned" ? "Set aside" : "Finished"}>
                {archivalDate(book.finished_on)}
                {book.started_on && book.status === "finished" ? ` (${plural(daysBetween(book.started_on, book.finished_on), "day")})` : ""}
              </Fact>
            )}
          </dl>

          <div className="mt-7 max-w-xl border-t border-rule pt-4">
            <div className="label mb-2">Where it stands</div>
            <StatusControl bookId={book.id} status={book.status} />
          </div>
        </div>
      </header>

      {book.description && (
        <section className="mx-auto mt-14 max-w-2xl">
          <p className="dropcap text-[1.22rem] leading-[1.65] text-ink">{book.description}</p>
        </section>
      )}

      {/* ——— the two ribbons ——— */}
      {(active || anyoneBegun) && (
        <section aria-labelledby="ribbons-h" className="mt-14">
          <OrnamentRule>
            <h2 id="ribbons-h" className="label">Our ribbons</h2>
          </OrnamentRule>
          <div className="relative mx-auto max-w-3xl">
            <Ribbons book={book} readings={readings} />
            <Verdict monkey={pos.monkey} cat={pos.cat} className="absolute -top-1 right-0 max-sm:hidden" />
          </div>
          {book.status === "reading" && (
            <div className="mx-auto mb-2 max-w-3xl text-[1.08rem]">
              {book.goal_chapter ? (
                <p>
                  <span className="label mr-2">Next stop</span>
                  {chapterLabel(book.goal_chapter)}
                  {book.goal_date ? `, by ${longDate(book.goal_date)}` : ""}.{" "}
                </p>
              ) : null}
              <div className="mt-1">
                <GoalForm bookId={book.id} goalChapter={book.goal_chapter} goalDate={book.goal_date} totalChapters={book.total_chapters} />
              </div>
            </div>
          )}
          {active && (
            <div className="mx-auto mt-8 max-w-3xl border-t border-dashed border-rule pt-6">
              <h3 className="label mb-4">Move your ribbon</h3>
              <BookmarkForm
                bookId={book.id}
                reader={reader}
                totalChapters={book.total_chapters}
                totalPages={book.total_pages}
                chapter={mine?.chapter ?? 0}
                page={mine?.page ?? null}
                finished={Boolean(mine?.finished_on)}
              />
            </div>
          )}
        </section>
      )}

      <div className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-16 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-16">
          {/* ——— contents ——— */}
          <section id="contents" aria-labelledby="contents-h" className="scroll-mt-10">
            <h2 id="contents-h" className="font-display text-3xl">Contents</h2>
            <p className="mt-1 italic text-ink-faint">Chapter by chapter, and what we left in the margins of each.</p>
            <Contents book={book} notes={notes} reader={reader} pos={pos} />
          </section>

          {/* ——— latest marginalia, and a pen ——— */}
          <section aria-labelledby="latest-h">
            <h2 id="latest-h" className="font-display text-3xl">In the margins</h2>
            {latest.length > 0 ? (
              <ul className="mt-3 divide-y divide-rule-soft border-t border-rule">
                {latest.map((n) => (
                  <li key={n.id}>
                    <Snippet note={n} showBook={false} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 italic text-ink-faint">Not a single note yet. Somebody has to go first.</p>
            )}
            <div className="mt-8 border-t border-rule pt-6">
              <Composer
                bookId={book.id}
                reader={reader}
                totalChapters={book.total_chapters}
                defaultChapter={mine?.finished_on ? AFTERWORD : mine?.chapter ?? PRELUDE}
                otherHorizon={view.horizons[other]}
              />
            </div>
          </section>

          {/* ——— our pages ——— */}
          <section aria-labelledby="pages-h">
            <h2 id="pages-h" className="font-display text-3xl">Our pages</h2>
            <p className="mt-1 italic text-ink-faint">Longer thoughts, kept with the book.</p>
            <div className="mt-6 grid gap-10 sm:grid-cols-2">
              {MEMBER_KEYS.map((k) => (
                <MemberNotes key={k} bookId={book.id} who={k} text={readings[k]?.notes ?? null} editable={k === reader} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-14">
          {/* ——— verdicts ——— */}
          <section aria-labelledby="verdicts-h">
            <h2 id="verdicts-h" className="label">Verdicts</h2>
            <div className="mt-4 space-y-4 border-t border-rule pt-4">
              {MEMBER_KEYS.map((k) => (
                <div key={k}>
                  <div className="mb-1 flex items-center gap-2 text-sm text-ink-soft">
                    <Head who={k} size={14} /> {member(k).name}, in {member(k).ratingUnit}s
                  </div>
                  <Rating bookId={book.id} who={k} value={readings[k]?.rating ?? null} editable={k === reader} />
                </div>
              ))}
            </div>
            {divided && (
              <p className="mt-4 -rotate-1 text-[1.02rem]" style={{ fontFamily: club.members.cat.hand, color: "var(--cat)" }}>
                the jury is divided.
              </p>
            )}
            {unanimous && <div className="stamp mt-5 -rotate-3">Unanimous</div>}
          </section>

          {favs.length > 0 && (
            <section aria-labelledby="favs-h">
              <h2 id="favs-h" className="label">Favourite moments</h2>
              <p className="mt-1 text-sm italic text-ink-faint">notes one of us pointed at ☞</p>
              <ul className="mt-2 divide-y divide-rule-soft border-t border-rule">
                {favs.map((n) => (
                  <li key={n.id}>
                    <Snippet note={noteData({ ...n, sealed: false })} showBook={false} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {quotes.length > 0 && (
            <section aria-labelledby="quotes-h">
              <h2 id="quotes-h" className="label">Copied out</h2>
              <ul className="mt-3 space-y-5 border-t border-rule pt-4">
                {quotes.map((n) =>
                  n.sealed ? null : (
                    <li key={n.id}>
                      <Link href={`/books/${book.id}/chapter/${n.chapter}#note-${n.id}`} className="group block">
                        <p className="text-[1.08rem] leading-snug italic group-hover:text-wax">“{n.quote}”</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-faint">
                          <Head who={n.member} size={12} /> {chapterLabel(n.chapter)}
                          {n.page ? `, p. ${n.page}` : ""}
                        </p>
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </section>
          )}

          <section aria-labelledby="timeline-h">
            <h2 id="timeline-h" className="label">Our reading, in order</h2>
            <Timeline book={book} events={events} />
          </section>
        </aside>
      </div>

      <footer className="mt-20 flex flex-col items-center gap-6">
        <Eternity width={22} height={22} className="text-ink-faint" />
        <DeleteBook bookId={book.id} title={book.title} />
      </footer>
    </article>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-faint">{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

function StatusStamp({ book }: { book: Book }) {
  const text =
    book.status === "finished" ? (
      <>
        Letto <span className="opacity-60">·</span> <span lang="hy">Կարդացված</span>
      </>
    ) : book.status === "abandoned" ? (
      "Set aside"
    ) : book.status === "reading" ? (
      "On the desk"
    ) : (
      "Received"
    );
  const date = book.status === "finished" || book.status === "abandoned" ? book.finished_on : book.status === "reading" ? book.started_on : null;
  return (
    <div className="stamp absolute -right-8 -bottom-4 rotate-[-7deg] flex-col !gap-0 bg-paper/40 text-center">
      <span>{text}</span>
      {date && <span className="text-[0.62rem] tracking-[0.2em]">{archivalDate(date)}</span>}
    </div>
  );
}

function Contents({ book, notes, reader, pos }: { book: Book; notes: Note[]; reader: MemberKey; pos: ReturnType<typeof positions> }) {
  const rows = sections(book.total_chapters).map((ch) => {
    const here = notes.filter((n) => n.chapter === ch);
    return {
      ch,
      counts: { monkey: here.filter((n) => n.member === "monkey").length, cat: here.filter((n) => n.member === "cat").length },
      sealed: here.some((n) => n.sealed),
      ribbons: MEMBER_KEYS.filter((k) => pos[k].begun && !pos[k].finished && pos[k].chapter === ch),
    };
  });
  const long = rows.length > 16;
  return (
    <ol className={`mt-6 border-t border-rule ${long ? "md:columns-2 md:gap-x-10" : ""}`}>
      {rows.map((r) => (
        <li key={r.ch} className="break-inside-avoid">
          <Link href={`/books/${book.id}/chapter/${r.ch}`} className="group flex items-center gap-3 py-2">
            {r.ch === PRELUDE || r.ch === AFTERWORD ? (
              <span className="shrink-0 font-display text-lg italic text-ink-soft group-hover:text-wax">{r.ch === PRELUDE ? "Prelude" : "Afterword"}</span>
            ) : (
              <span className="shrink-0 font-display text-lg group-hover:text-wax">
                <span className="sr-only">Chapter </span>
                {chapterShort(r.ch)}
              </span>
            )}
            <span className="mb-1 min-w-4 flex-1 self-end border-b border-dotted border-ink-faint/40" aria-hidden />
            {r.ribbons.map((k) => (
              <span key={k} className="flex items-center gap-1 text-[0.95rem] leading-none" style={{ fontFamily: member(k).hand, color: `var(--${k})` }} title={`${member(k).name}'s ribbon`}>
                <span className={`inline-block h-3 w-1.5 ${k === "monkey" ? "bg-monkey" : "bg-cat"}`} aria-hidden />
                {k === reader ? "you" : member(k).name}
              </span>
            ))}
            {r.sealed && <WaxSeal className="h-4 w-4 shrink-0" aria-label="sealed for you" />}
            <span className="flex w-16 shrink-0 items-center justify-end gap-2 typed text-[0.75rem] text-ink-faint">
              {r.counts.monkey > 0 && (
                <span className="flex items-center gap-0.5">
                  <Head who="monkey" size={11} />
                  {r.counts.monkey}
                </span>
              )}
              {r.counts.cat > 0 && (
                <span className="flex items-center gap-0.5">
                  <Head who="cat" size={11} />
                  {r.counts.cat}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Timeline({ book, events }: { book: Book; events: ReadingEvent[] }) {
  type Item = { at: Date; who?: MemberKey; text: React.ReactNode; gossip?: boolean };
  const items: Item[] = [{ at: book.created_at, who: book.added_by, text: <>accessioned it</> }];
  for (const e of events) {
    const ch = e.chapter != null ? chapterLabel(e.chapter) : "";
    items.push({
      at: e.created_at,
      who: e.member,
      gossip: e.kind === "seal",
      text:
        e.kind === "began" ? <>opened it</>
        : e.kind === "finished" ? <>read the last page</>
        : e.kind === "seal" ? <>broke the seal on {ch}</>
        : <>reached {ch}</>,
    });
  }
  if (book.status === "finished" && book.finished_on) {
    items.push({ at: new Date(`${book.finished_on}T23:59:00Z`), text: <>Closed, and shelved with the others.</> });
  }
  items.sort((a, b) => +a.at - +b.at);
  return (
    <ol className="relative mt-4 space-y-3 border-l border-rule pl-5">
      {items.map((it, i) => (
        <li key={i} className="relative text-[0.98rem] leading-snug">
          <span className={`absolute top-[0.45rem] -left-[1.42rem] h-2 w-2 rounded-full ${it.gossip ? "bg-wax" : "bg-rule"}`} aria-hidden />
          <span className="typed mr-2 text-[0.68rem] text-ink-faint" title={whenSaid(it.at)}>
            {archivalDate(it.at)}
          </span>
          {it.who ? (
            <>
              <span style={{ color: `var(--${it.who})` }}>{it.who === "monkey" ? "The monkey" : "The cat"}</span> {it.text}
              {it.gossip ? <span className="italic text-ink-faint">. Noted.</span> : "."}
            </>
          ) : (
            <span className="italic">{it.text}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
