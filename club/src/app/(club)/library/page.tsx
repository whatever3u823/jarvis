import type { Metadata } from "next";
import Link from "next/link";
import { requireReader } from "@/lib/session";
import { listBooks } from "@/lib/data/books";
import { noteCountsByBook } from "@/lib/data/thoughts";
import { coverSrc } from "@/lib/covers";
import { count, todayISO } from "@/lib/format";
import { hash, wobble } from "@/lib/cloth";
import type { Book, Status } from "@/lib/data/types";
import { Spine } from "@/components/book/Spine";
import { Cover } from "@/components/book/Cover";
import { Cat, Monkey } from "@/components/creatures";

export const metadata: Metadata = { title: "Shelves" };

const SHELVES: { status: Status; title: string; aside: string; empty: string }[] = [
  { status: "reading", title: "On the desk", aside: "open, and being argued over", empty: "Nothing open. Suspicious." },
  { status: "want", title: "The pile", aside: "promised to each other", empty: "The pile is empty, which has never happened to anyone." },
  { status: "finished", title: "Read together", aside: "closed, and kept", empty: "Nothing finished yet. Everything is still possible." },
  { status: "abandoned", title: "Set aside", aside: "abandoned, not forgotten*", empty: "We have never given up on a book. Yet." },
];

export default async function Library({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireReader();
  const { view } = await searchParams;
  const covers = view === "covers";
  const [books, notes] = await Promise.all([listBooks(), noteCountsByBook()]);
  const byStatus = new Map<Status, Book[]>();
  for (const b of books) byStatus.set(b.status, [...(byStatus.get(b.status) ?? []), b]);
  // Where the cat has decided to sleep today.
  const day = hash(todayISO());
  const catShelf = SHELVES.map((s) => s.status).filter((s) => (byStatus.get(s)?.length ?? 0) > 0)[day % 3] ?? "finished";

  return (
    <div className="pt-8 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-5xl leading-none sm:text-6xl">The Shelves</h1>
          <p className="mt-3 text-lg italic text-ink-soft">
            Our <s className="decoration-wax/70">library</s> shelves, such as they are: {count(books.length, "book")}.
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1 text-[0.95rem] italic" role="group" aria-label="View">
            <Link href="/library" aria-current={!covers ? "page" : undefined} className={!covers ? "text-ink underline decoration-rule underline-offset-4" : "text-ink-faint hover:text-ink"}>
              spines
            </Link>
            <span className="text-ink-faint">/</span>
            <Link href="/library?view=covers" aria-current={covers ? "page" : undefined} className={covers ? "text-ink underline decoration-rule underline-offset-4" : "text-ink-faint hover:text-ink"}>
              covers
            </Link>
          </div>
          <Link href="/books/new" className="btn btn-solid">
            + Accession a book
          </Link>
        </div>
      </div>

      {books.length === 0 ? (
        <div className="mt-20 flex flex-col items-center text-center">
          <Monkey pose="read" width={90} className="text-monkey" />
          <p className="mt-6 max-w-md text-xl italic text-ink-soft">
            The shelves are bare. The cat has already checked behind them.
          </p>
          <Link href="/books/new" className="btn mt-8">
            Bring the first book home
          </Link>
        </div>
      ) : (
        <div className="mt-12 space-y-16">
          {SHELVES.map((shelf) => {
            const list = byStatus.get(shelf.status) ?? [];
            if (list.length === 0 && shelf.status !== "reading") return null;
            return (
              <section key={shelf.status} aria-labelledby={`shelf-${shelf.status}`}>
                <div className="mb-5 flex items-baseline gap-4">
                  <h2 id={`shelf-${shelf.status}`} className="font-display text-3xl">
                    {shelf.title}
                  </h2>
                  <span className="text-[1rem] italic text-ink-faint">{shelf.aside}</span>
                  <span className="typed ml-auto text-xs text-ink-faint">{list.length}</span>
                </div>
                {list.length === 0 ? (
                  <p className="border-b border-rule pb-6 italic text-ink-faint">{shelf.empty}</p>
                ) : covers ? (
                  <ul className="grid grid-cols-2 gap-x-6 gap-y-10 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
                    {list.map((b) => (
                      <li key={b.id}>
                        <Link href={`/books/${b.id}`} className="group block">
                          <Cover title={b.title} author={b.author} src={coverSrc(b)} size="md" className="!w-full transition-transform group-hover:-translate-y-1" tilt={(wobble(b.id) - 0.5) * 3} />
                          <div className="mt-3 font-display text-lg leading-tight group-hover:text-wax">{b.title}</div>
                          <div className="text-sm italic text-ink-soft">{b.author}</div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="relative">
                    <div className="shelf">
                      {list.map((b, i) => (
                        <Spine key={b.id} book={b} notes={(notes.get(b.id)?.monkey ?? 0) + (notes.get(b.id)?.cat ?? 0)} leaning={list.length > 2 && i === list.length - 1} />
                      ))}
                    </div>
                    {catShelf === shelf.status && (
                      <Cat
                        pose="loaf"
                        width={74}
                        className="absolute -top-[2.1rem] right-3 text-ink md:top-auto md:right-6 md:bottom-[10px]"
                        title="The cat, asleep on the shelf"
                      />
                    )}
                  </div>
                )}
              </section>
            );
          })}
          {(byStatus.get("abandoned")?.length ?? 0) > 0 && (
            <p className="text-sm italic text-ink-faint">
              * The cat remembers every book we gave up on, and on which page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
