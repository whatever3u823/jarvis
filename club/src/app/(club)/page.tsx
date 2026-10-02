import Link from "next/link";
import { club, member, otherMember } from "@/club.config";
import { requireReader } from "@/lib/session";
import { getAllReadings, getBrokenSeals, getCurrentBooks, listBooks } from "@/lib/data/books";
import { recentThoughts, redact } from "@/lib/data/thoughts";
import { ledger } from "@/lib/data/stats";
import { threads } from "@/lib/threads";
import { coverSrc } from "@/lib/covers";
import { accession, archivalDate, count, daysBetween, hourNow, longDate, todayISO } from "@/lib/format";
import { chapterLabel, roman } from "@/lib/chapters";
import { Cover } from "@/components/book/Cover";
import { Ribbons, positions } from "@/components/book/Ribbons";
import { Verdict } from "@/components/book/Verdict";
import { BookmarkForm } from "@/components/progress/BookmarkForm";
import { Snippet } from "@/components/notes/Snippet";
import { Cat, Head, Monkey } from "@/components/creatures";
import { Fleuron, OrnamentRule } from "@/components/ornaments";
import { StartReading } from "./StartReading";
import type { Book, Readings } from "@/lib/data/types";

export default async function Desk() {
  const reader = await requireReader();
  const [current, books, readings, seals, recent, stats] = await Promise.all([
    getCurrentBooks(),
    listBooks(),
    getAllReadings(),
    getBrokenSeals(reader),
    recentThoughts(14),
    ledger(),
  ]);
  const titles = new Map(books.map((b) => [b.id, b.title]));
  const notes = threads(redact(recent, reader, readings, seals))
    .reverse()
    .slice(0, 7);
  const desk = current[0] ?? null;
  const alsoOpen = current.slice(1);
  const shelved = books.filter((b) => b.status === "finished").slice(0, 4);
  const pile = books.filter((b) => b.status === "want");
  const me = member(reader);
  const late = hourNow() >= 23 || hourNow() < 5;
  const greeting = late ? me.goodnight : me.hello;

  return (
    <div className="pt-6 md:pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[1.6rem] leading-none" style={{ fontFamily: me.hand, color: `var(--${reader})`, fontSize: reader === "monkey" ? "1.9rem" : "1.35rem" }} title={greeting.gloss}>
          {greeting.text}
        </p>
        <p className="typed text-[0.72rem] text-ink-faint">{longDate(new Date())}</p>
      </div>

      {desk ? (
        <OnTheDesk book={desk} readings={readings.get(desk.id) ?? { monkey: null, cat: null }} reader={reader} />
      ) : (
        <EmptyDesk pile={pile} />
      )}

      <div className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-x-14 gap-y-14 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="margins-h">
          <h2 id="margins-h" className="flex items-baseline gap-3">
            <span className="font-display text-3xl">Lately, in the margins</span>
          </h2>
          {notes.length ? (
            <ul className="mt-3 divide-y divide-rule-soft border-t border-rule">
              {notes.map((n) => (
                <li key={n.id}>
                  <Snippet note={n} bookTitle={titles.get(n.book_id)} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 flex items-end gap-5 border-t border-rule pt-6">
              <Monkey pose="read" width={48} className="text-monkey opacity-80" />
              <p className="max-w-sm text-lg italic text-ink-soft">
                The margins are suspiciously clean. Somebody has to write the first note; traditionally it’s whoever is losing.
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-12">
          <section aria-labelledby="ledger-h">
            <h2 id="ledger-h" className="label">The ledger</h2>
            <dl className="mt-3 border-t border-rule">
              <LedgerRow term="Read together" value={count(stats.finished, "book")} />
              <LedgerRow term="Pages turned" value={stats.pages.toLocaleString("en-GB")} />
              <LedgerRow term="Notes in the margins" value={String(stats.notes)} />
              <LedgerRow
                term="First to the last page"
                value={
                  <span className="flex items-center gap-2">
                    <Head who="monkey" size={14} /> {stats.firstFinish.monkey}
                    <span className="text-ink-faint">·</span>
                    <Head who="cat" size={14} /> {stats.firstFinish.cat}
                  </span>
                }
              />
              <LedgerRow term="Seals broken" value={
                <span className="flex items-center gap-2">
                  <Head who="monkey" size={14} /> {stats.sealsBroken.monkey}
                  <span className="text-ink-faint">·</span>
                  <Head who="cat" size={14} /> {stats.sealsBroken.cat}
                </span>
              } />
              {stats.abandoned > 0 && <LedgerRow term="Abandoned, not forgotten" value={String(stats.abandoned)} />}
            </dl>
            {stats.since && <p className="mt-2 text-sm italic text-ink-faint">Kept since {longDate(stats.since)}.</p>}
          </section>

          {shelved.length > 0 && (
            <section aria-labelledby="shelved-h">
              <h2 id="shelved-h" className="label">Lately shelved</h2>
              <ul className="mt-4 flex items-end gap-3">
                {shelved.map((b, i) => (
                  <li key={b.id}>
                    <Link href={`/books/${b.id}`} title={`${b.title}, finished ${b.finished_on ? longDate(b.finished_on) : ""}`} className="block transition-transform hover:-translate-y-1">
                      <Cover title={b.title} author={b.author} src={coverSrc(b)} size="sm" tilt={[-2, 1.5, -0.5, 2][i]} />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/archive" className="mt-4 inline-block text-[0.95rem] italic text-ink-soft hover:text-ink">
                the whole archive →
              </Link>
            </section>
          )}

          {alsoOpen.length > 0 && (
            <section aria-labelledby="open-h">
              <h2 id="open-h" className="label">Also open</h2>
              <ul className="mt-3 space-y-2">
                {alsoOpen.map((b) => (
                  <li key={b.id}>
                    <Link href={`/books/${b.id}`} className="font-display text-lg hover:text-wax">
                      {b.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pile.length > 0 && desk && (
            <section aria-labelledby="pile-h">
              <h2 id="pile-h" className="label">The pile</h2>
              <p className="mt-3 text-[1.05rem] leading-snug">
                {count(pile.length, "book")} waiting, the oldest being{" "}
                <Link href={`/books/${pile[pile.length - 1].id}`} className="ink-link italic">
                  {pile[pile.length - 1].title}
                </Link>
                .
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function LedgerRow({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-rule py-2">
      <dt className="text-[1rem] text-ink-soft">{term}</dt>
      <dd className="typed text-[0.95rem]">{value}</dd>
    </div>
  );
}

function OnTheDesk({ book, readings, reader }: { book: Book; readings: Readings; reader: "monkey" | "cat" }) {
  const pos = positions(book, readings);
  const mine = readings[reader];
  const other = otherMember(reader);
  const goalDays = book.goal_date ? daysBetween(todayISO(), book.goal_date) : null;

  return (
    <section aria-labelledby="desk-h" className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-x-14 gap-y-10 md:grid-cols-[auto_minmax(0,1fr)]">
      <div className="relative mx-auto self-start md:mx-0">
        <Link href={`/books/${book.id}`} className="block transition-transform duration-300 hover:-rotate-1">
          <Cover title={book.title} author={book.author} src={coverSrc(book)} size="xl" tilt={-1.5} />
        </Link>
        {/* a ribbon for each of us, hanging out of the bottom of the book */}
        <div className="pointer-events-none absolute -bottom-7 left-[30%] flex gap-2" aria-hidden>
          <span className="h-10 w-2 bg-monkey [clip-path:polygon(0_0,100%_0,100%_100%,50%_82%,0_100%)]" />
          <span className="mt-1 h-12 w-2 bg-cat [clip-path:polygon(0_0,100%_0,100%_100%,50%_82%,0_100%)]" />
        </div>
        <Cat pose="peek" width={56} className="absolute -top-[22px] right-3 text-ink max-md:hidden" />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="label">On the desk</span>
          <span className="typed text-[0.7rem] text-ink-faint">{accession(book.id)}</span>
        </div>
        <h1 id="desk-h" className="mt-3 font-display text-[2.6rem] leading-[0.98] tracking-[-0.01em] text-balance sm:text-6xl">
          <Link href={`/books/${book.id}`} className="hover:text-wax">
            {book.title}
          </Link>
        </h1>
        <p className="mt-3 text-xl italic text-ink-soft">
          {book.author}
          {book.translator ? <span className="text-ink-faint">, translated by {book.translator}</span> : null}
        </p>

        <div className="relative mt-4 max-w-2xl">
          <Ribbons book={book} readings={readings} />
          <Verdict monkey={pos.monkey} cat={pos.cat} className="absolute -top-2 right-0 max-sm:hidden" />
        </div>

        {book.goal_chapter && (
          <p className="max-w-2xl text-[1.1rem] leading-relaxed">
            <span className="label mr-2">Next stop</span>
            {chapterLabel(book.goal_chapter)}
            {book.goal_date && (
              <>
                , by {longDate(book.goal_date)}{" "}
                <span className="italic text-ink-faint">
                  {goalDays === null ? "" : goalDays > 1 ? `(in ${goalDays} days)` : goalDays === 1 ? "(tomorrow)" : goalDays === 0 ? "(today!)" : "(that ship has sailed)"}
                </span>
              </>
            )}
            .{" "}
            {(["monkey", "cat"] as const)
              .filter((k) => pos[k].finished || pos[k].chapter > book.goal_chapter!)
              .map((k) => (
                <span key={k} className="italic text-ink-soft">
                  {member(k).name} is already past it.{" "}
                </span>
              ))}
          </p>
        )}

        <div className="mt-8 grid gap-10 border-t border-rule pt-6 sm:grid-cols-2">
          <div>
            <h2 className="label mb-4">Your ribbon</h2>
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
          <div className="flex flex-col justify-between gap-6">
            <div>
              <h2 className="label mb-3">In the margins of this one</h2>
              <ul className="space-y-1.5 text-[1.05rem]">
                <li>
                  <Link className="ink-link" href={`/books/${book.id}/chapter/${Math.max(1, mine?.chapter ?? 1)}`}>
                    Write about {chapterLabel(Math.max(1, mine?.chapter ?? 1))}
                  </Link>
                </li>
                <li>
                  <Link className="ink-link" href={`/books/${book.id}#contents`}>
                    Chapter by chapter
                  </Link>
                </li>
                <li>
                  <Link className="ink-link" href={`/books/${book.id}`}>
                    The whole dossier
                  </Link>
                </li>
              </ul>
            </div>
            <p className="text-sm italic text-ink-faint">
              Begun {book.started_on ? archivalDate(book.started_on) : "—"}.{" "}
              {member(other).name}’s ribbon: {pos[other].finished ? "at the end" : pos[other].chapter ? `chapter ${roman(pos[other].chapter)}` : "not yet in"}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyDesk({ pile }: { pile: Book[] }) {
  return (
    <section className="mt-10" aria-labelledby="empty-h">
      <div className="mx-auto max-w-2xl text-center">
        <Cat pose="loaf" className="mx-auto w-44 text-ink" />
        <div className="rule mx-auto -mt-1 w-72" />
        <h1 id="empty-h" className="mt-8 font-display text-4xl sm:text-5xl">
          Nothing on the desk.
        </h1>
        <p className="mt-3 text-lg italic text-ink-soft">The cat is asleep on it. This can be fixed.</p>
      </div>
      {pile.length > 0 ? (
        <div className="mx-auto mt-10 max-w-2xl">
          <OrnamentRule>
            <span className="label">From the pile</span>
          </OrnamentRule>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2">
            {pile.slice(0, 4).map((b) => (
              <li key={b.id} className="flex gap-4">
                <Cover title={b.title} author={b.author} src={coverSrc(b)} size="sm" />
                <div className="min-w-0">
                  <Link href={`/books/${b.id}`} className="font-display text-xl leading-tight hover:text-wax">
                    {b.title}
                  </Link>
                  <p className="text-ink-soft italic">{b.author}</p>
                  <StartReading bookId={b.id} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-8 text-center">
          <Link href="/books/new" className="btn btn-solid">
            Add the first book
          </Link>
          <p className="mx-auto mt-6 flex max-w-sm items-center justify-center gap-2 text-sm text-ink-faint italic">
            <Fleuron width={22} height={14} /> {club.motto}
          </p>
        </div>
      )}
    </section>
  );
}
