import type { Metadata } from "next";
import Link from "next/link";
import { club, member, MEMBER_KEYS } from "@/club.config";
import { requireReader } from "@/lib/session";
import { getAllReadings, getBrokenSeals, listBooks } from "@/lib/data/books";
import { favourites, noteCountsByBook, redact } from "@/lib/data/thoughts";
import { db } from "@/lib/db";
import { ledger } from "@/lib/data/stats";
import { coverSrc } from "@/lib/covers";
import { accession, archivalDate, count, daysBetween, plural } from "@/lib/format";
import { roman } from "@/lib/chapters";
import { wobble } from "@/lib/cloth";
import type { Thought } from "@/lib/data/types";
import { Cover } from "@/components/book/Cover";
import { Rating } from "@/components/book/Rating";
import { Cat, Head } from "@/components/creatures";
import { Eternity, Manicule } from "@/components/ornaments";

export const metadata: Metadata = { title: "The Archive" };

export default async function Archive() {
  const reader = await requireReader();
  const [books, readings, counts, stats, seals] = await Promise.all([listBooks(), getAllReadings(), noteCountsByBook(), ledger(), getBrokenSeals(reader)]);
  const closed = books
    .filter((b) => b.status === "finished" || b.status === "abandoned")
    .sort((a, b) => (a.finished_on ?? a.started_on ?? "").localeCompare(b.finished_on ?? b.started_on ?? ""));

  // The most-pointed-at note of each closed book.
  const ids = closed.map((b) => b.id);
  const marked = ids.length
    ? (
        await db().query<Thought & { marks: Thought["marks"] }>(
          `select t.*, coalesce((select json_agg(json_build_object('member', m.member, 'mark', m.mark)) from marks m where m.thought_id = t.id), '[]') as marks
           from thoughts t where t.book_id = any($1) and exists (select 1 from marks m where m.thought_id = t.id and m.mark = 'manicule')`,
          [ids],
        )
      ).rows
    : [];
  const best = new Map<number, Thought>();
  for (const n of favourites(redact(marked, reader, readings, seals))) if (!best.has(n.book_id)) best.set(n.book_id, n);

  const years = new Map<number, typeof closed>();
  for (const b of closed) {
    const y = Number((b.finished_on ?? b.started_on ?? String(new Date().getFullYear())).slice(0, 4));
    years.set(y, [...(years.get(y) ?? []), b]);
  }

  return (
    <div className="pt-8 md:pt-12">
      <header className="max-w-3xl">
        <h1 className="font-display text-5xl leading-none sm:text-6xl">The Archive</h1>
        <p className="mt-4 text-xl leading-relaxed italic text-ink-soft">
          Everything we have read together, in the order it happened.{" "}
          {stats.finished > 0 && (
            <>
              So far: {count(stats.finished, "book")}, {stats.pages.toLocaleString("en-GB")} pages, and {count(stats.notes, "note")} in the margins.
            </>
          )}
        </p>
      </header>

      {closed.length === 0 ? (
        <div className="mt-20 flex flex-col items-center text-center">
          <Cat pose="loaf" width={150} className="text-ink" />
          <p className="mt-6 max-w-md text-xl italic text-ink-soft">
            The archive is empty. It fills one finished book at a time; the first is always the hardest to close.
          </p>
        </div>
      ) : (
        <div className="mt-14 space-y-16">
          {[...years.entries()].map(([year, list]) => (
            <section key={year} aria-labelledby={`y-${year}`}>
              <div className="flex items-baseline gap-4 border-b-2 border-ink pb-2">
                <h2 id={`y-${year}`} className="font-display text-4xl">
                  {year}
                </h2>
                <span className="typed text-xs text-ink-faint">{roman(year)}</span>
                <span className="ml-auto text-sm italic text-ink-faint">{count(list.length, "volume")}</span>
              </div>
              <ol>
                {list.map((b) => {
                  const r = readings.get(b.id) ?? { monkey: null, cat: null };
                  const n = counts.get(b.id) ?? { monkey: 0, cat: 0 };
                  const fav = best.get(b.id);
                  const days = b.started_on && b.finished_on ? daysBetween(b.started_on, b.finished_on) : null;
                  const abandoned = b.status === "abandoned";
                  return (
                    <li key={b.id} className="grid gap-x-8 gap-y-4 border-b border-rule py-8 sm:grid-cols-[4.5rem_minmax(0,1fr)] lg:grid-cols-[4.5rem_minmax(0,1fr)_17rem]">
                      <div className="flex gap-4 sm:block">
                        <Link href={`/books/${b.id}`} aria-hidden tabIndex={-1}>
                          <Cover title={b.title} author={b.author} src={coverSrc(b)} size="sm" tilt={(wobble(b.id) - 0.5) * 4} className={abandoned ? "opacity-70 grayscale-[40%]" : ""} />
                        </Link>
                        <div className="typed mt-3 text-[0.7rem] text-ink-faint">{accession(b.id)}</div>
                      </div>
                      <div className="min-w-0">
                        <Link href={`/books/${b.id}`} className="group">
                          <h3 className="font-display text-3xl leading-tight group-hover:text-wax">
                            {abandoned ? <s className="decoration-ink-faint/60 decoration-1">{b.title}</s> : b.title}
                          </h3>
                        </Link>
                        <p className="italic text-ink-soft">{b.author}</p>
                        <p className="typed mt-3 text-[0.78rem] text-ink-soft">
                          {b.started_on ? archivalDate(b.started_on) : "?"} → {b.finished_on ? archivalDate(b.finished_on) : "?"}
                          {days != null && <span className="text-ink-faint"> · {plural(days, "day")}</span>}
                          <span className="text-ink-faint"> · {plural(n.monkey + n.cat, "note")}</span>
                        </p>
                        {abandoned && (
                          <p className="mt-2 text-[0.98rem] italic text-ink-faint">
                            Set aside at {MEMBER_KEYS.map((k) => `${member(k).name}: ch. ${roman(r[k]?.chapter || 0) || "—"}`).join(", ")}.
                          </p>
                        )}
                        {fav && !fav.reply_to && (
                          <Link href={`/books/${b.id}/chapter/${fav.chapter}#note-${fav.id}`} className="group mt-4 flex gap-3">
                            <Manicule width={26} height={13} className="mt-1.5 shrink-0 text-ink-faint" />
                            <span className="text-[1.05rem] leading-snug italic text-ink-soft group-hover:text-ink">
                              “{fav.body}” <span className="not-italic text-sm text-ink-faint">— {member(fav.member).name}</span>
                            </span>
                          </Link>
                        )}
                      </div>
                      <div className="flex flex-col gap-3 sm:col-start-2 lg:col-start-auto lg:items-end">
                        {!abandoned &&
                          MEMBER_KEYS.map((k) => (
                            <div key={k} className="flex items-center gap-2">
                              <Head who={k} size={14} />
                              <Rating bookId={b.id} who={k} value={r[k]?.rating ?? null} editable={false} />
                            </div>
                          ))}
                        <div className={`stamp mt-1 w-fit ${wobble(b.id, 9) > 0.5 ? "rotate-[-4deg]" : "rotate-[3deg]"}`}>
                          {abandoned ? "Set aside" : <>Letto · <span lang="hy">Կարդացված</span></>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          <div className="flex flex-col items-center gap-4 pt-6 text-center">
            <Eternity width={26} height={26} className="text-ink-faint" />
            <p className="text-lg italic text-ink-faint">Here the archive ends, for now.</p>
            <Cat pose="loaf" width={70} className="text-ink/80" />
            <p className="text-sm text-ink-faint" title={club.mottoGloss}>
              {club.motto}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
