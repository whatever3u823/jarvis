import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { club, isMemberKey, otherMember } from "@/club.config";
import { requireReader } from "@/lib/session";
import { db } from "@/lib/db";
import { getAllReadings, getBrokenSeals, listBooks } from "@/lib/data/books";
import { redact, thoughtsByMember } from "@/lib/data/thoughts";
import { ledger } from "@/lib/data/stats";
import { threads } from "@/lib/threads";
import { archivalDate, count } from "@/lib/format";
import { chapterLabel } from "@/lib/chapters";
import { coverSrc } from "@/lib/covers";
import { Portrait } from "@/components/Portrait";
import { Snippet } from "@/components/notes/Snippet";
import { Rating } from "@/components/book/Rating";
import { Cover } from "@/components/book/Cover";
import { leave } from "@/lib/actions/session";

type Props = { params: Promise<{ member: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const key = (await params).member;
  return { title: isMemberKey(key) ? `${club.members[key].name}, ${club.members[key].epithet}` : "Nobody" };
}

export default async function MemberPage({ params }: Props) {
  const reader = await requireReader();
  const key = (await params).member;
  if (!isMemberKey(key)) notFound();
  const m = club.members[key];
  const [books, readings, stats, theirs, seals, given] = await Promise.all([
    listBooks(),
    getAllReadings(),
    ledger(),
    thoughtsByMember(key, 12),
    getBrokenSeals(reader),
    db().query<{ n: number }>(`select count(*)::int as n from marks where member = $1`, [key]),
  ]);
  const notes = threads(redact(theirs, reader, readings, seals)).reverse().slice(0, 6);
  const titles = new Map(books.map((b) => [b.id, b.title]));
  const history = books
    .map((b) => ({ book: b, r: readings.get(b.id)?.[key] ?? null }))
    .filter((x) => x.r && (x.r.started_on || x.r.chapter > 0 || x.r.finished_on));
  const finished = history.filter((x) => x.r?.finished_on).length;
  const rated = history.map((x) => x.r?.rating).filter((n): n is number => n != null);
  const avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
  const unit = m.ratingUnit === "lemon" ? "lemons" : "pomegranates";
  const isMe = key === reader;
  const other = club.members[otherMember(key)];

  return (
    <div className="pt-8 md:pt-12">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-10 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="md:pt-4">
          <Portrait who={key} />
        </div>
        <div>
          <div className="label">Member {key === "monkey" ? "no. 1" : "no. 2"} of 2</div>
          <h1 className="mt-3 leading-none" style={{ fontFamily: m.hand, color: `var(--${key})`, fontSize: key === "monkey" ? "5rem" : "3.6rem" }}>
            {m.name}
          </h1>
          <p className="mt-3 font-display text-2xl italic text-ink-soft">
            {m.epithet}, of {m.origin}
          </p>

          <dl className="typed mt-8 grid max-w-lg grid-cols-[1fr_auto] gap-y-1.5 text-[0.85rem]">
            <Stat term="Books finished">{finished}</Stat>
            <Stat term="Notes in the margins">{stats.notesBy[key]}</Stat>
            <Stat term="Marks left beside notes">{given.rows[0].n}</Stat>
            <Stat term="First to the last page">{count(stats.firstFinish[key], "time")}</Stat>
            <Stat term="Seals broken">{stats.sealsBroken[key]}</Stat>
            <Stat term={`Average verdict`}>{avg == null ? "—" : `${avg.toFixed(1)} ${unit}`}</Stat>
          </dl>

          <div className="mt-8 max-w-lg">
            <div className="label">Known habits</div>
            <ul className="mt-2 space-y-1 text-[1.05rem]">
              {m.habits.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="text-ink-faint">—</span> {h}
                </li>
              ))}
            </ul>
          </div>
          {isMe && (
            <form action={leave} className="mt-8">
              <button className="text-sm italic text-ink-faint hover:text-wax">not {m.name}? step out and come back in as {other.name}</button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-x-14 gap-y-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="hist-h">
          <h2 id="hist-h" className="font-display text-3xl">{isMe ? "What you’ve read" : `What ${m.name} has read`}</h2>
          {history.length === 0 ? (
            <p className="mt-3 italic text-ink-faint">Nothing yet. The ribbons are still in their packets.</p>
          ) : (
            <ul className="mt-4 divide-y divide-rule-soft border-t border-rule">
              {history.map(({ book, r }) => (
                <li key={book.id}>
                  <Link href={`/books/${book.id}`} className="group flex items-center gap-4 py-3">
                    <Cover title={book.title} author={book.author} src={coverSrc(book)} size="xs" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-lg leading-tight group-hover:text-wax">{book.title}</div>
                      <div className="text-sm italic text-ink-faint">
                        {r?.finished_on
                          ? `finished ${archivalDate(r.finished_on)}`
                          : book.status === "abandoned"
                            ? `set aside at ${chapterLabel(r?.chapter ?? 0)}`
                            : `on ${chapterLabel(r?.chapter || 1)}`}
                      </div>
                    </div>
                    {r?.rating ? <Rating bookId={book.id} who={key} value={r.rating} editable={false} /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="notes-h">
          <h2 id="notes-h" className="font-display text-3xl">{isMe ? "Your latest notes" : `${m.name}’s latest notes`}</h2>
          {notes.length === 0 ? (
            <p className="mt-3 italic text-ink-faint">Not a word in any margin. Mysterious.</p>
          ) : (
            <ul className="mt-4 divide-y divide-rule-soft border-t border-rule">
              {notes.map((n) => (
                <li key={n.id}>
                  <Snippet note={n} bookTitle={titles.get(n.book_id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-16 max-w-xl text-sm italic text-ink-faint">
        {key === "monkey"
          ? "* Not to be confused with the Librarian of Unseen University, who is an ape, and would like that noted."
          : "* The cat’s verdicts are final. Appeals may be submitted in writing, and will be sat on."}
      </p>
    </div>
  );
}

function Stat({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="border-b border-dotted border-rule pb-1 text-ink-soft">{term}</dt>
      <dd className="border-b border-dotted border-rule pb-1 text-right">{children}</dd>
    </>
  );
}
