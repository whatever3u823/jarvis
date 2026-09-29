"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SearchHit } from "@/lib/search/hybrid";
import { chapterLeaf, pageRange } from "@/lib/shared/format";
import { useReader } from "../reader/ReaderDrawer";

export function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\u0001[^\u0002]*\u0002)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("\u0001") ? (
          <mark key={i} className="hit">
            {p.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Similarity → 0..5 bars (thresholds tuned for bge-base cosine scores). */
function strength(sim: number): number {
  return [0.5, 0.57, 0.63, 0.69, 0.75].filter((t) => sim >= t).length;
}

export function RelevanceMeter({ hit }: { hit: SearchHit }) {
  const n = strength(hit.similarity);
  const via = hit.vectorRank && hit.keywordRank ? "meaning + words" : hit.vectorRank ? "meaning" : "words";
  return (
    <div className="flex items-center gap-2" title={`Cosine similarity ${hit.similarity.toFixed(3)} · matched by ${via}`}>
      <div className="flex items-end gap-[2px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`block w-[3px] ${i < n ? "bg-brass" : "bg-line-strong"}`} style={{ height: 4 + i * 2 }} />
        ))}
      </div>
      <span className="font-mono text-[10px] text-faint">{hit.similarity.toFixed(2)}</span>
    </div>
  );
}

export function SearchResults({ hits, query, scoped }: { hits: SearchHit[]; query: string; scoped?: boolean }) {
  const { open } = useReader();
  const [book, setBook] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const books = useMemo(() => {
    const m = new Map<string, { id: string; title: string; n: number }>();
    for (const h of hits) {
      const e = m.get(h.documentId) ?? { id: h.documentId, title: h.title, n: 0 };
      e.n++;
      m.set(h.documentId, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [hits]);

  const shown = book ? hits.filter((h) => h.documentId === book) : hits;

  if (hits.length === 0) {
    return (
      <div className="border-t border-line py-16 text-center">
        <div className="font-display text-2xl text-parchment">Nothing in the library matches “{query}”.</div>
        <p className="mt-2 text-sm text-muted">Try describing the idea in other words — search matches meaning as well as exact terms.</p>
      </div>
    );
  }

  return (
    <div>
      {!scoped && books.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2 font-mono text-[10.5px] tracking-wider uppercase">
          <FilterChip active={book === null} onClick={() => setBook(null)}>
            All · {hits.length}
          </FilterChip>
          {books.map((b) => (
            <FilterChip key={b.id} active={book === b.id} onClick={() => setBook(book === b.id ? null : b.id)}>
              {b.title.length > 36 ? b.title.slice(0, 34) + "…" : b.title} · {b.n}
            </FilterChip>
          ))}
        </div>
      )}

      <ol className="border-t border-line">
        {shown.map((h, i) => {
          const isOpen = expanded.has(h.chunkId);
          const openReader = () =>
            open({
              documentId: h.documentId,
              title: h.title,
              author: h.author,
              chapter: h.chapter,
              page: h.pageStart,
              chunkId: h.chunkId,
            });
          return (
            <li
              key={h.chunkId}
              className="group grid animate-rise grid-cols-1 gap-x-8 gap-y-2 border-b border-line py-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
              style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
            >
              <div className="min-w-0">
                {!scoped && (
                  <Link href={`/books/${h.documentId}`} className="block font-serif text-[16px] leading-snug text-ivory hover:text-brass-bright">
                    {h.title}
                  </Link>
                )}
                {!scoped && h.author && <div className="mt-0.5 text-[12.5px] text-muted">{h.author}</div>}
                <div className="mt-2 space-y-0.5 font-mono text-[10.5px] tracking-wide text-faint uppercase">
                  {chapterLeaf(h.chapter) && <div className="line-clamp-2 normal-case tracking-normal text-muted">{chapterLeaf(h.chapter)}</div>}
                  <div className="text-parchment">{pageRange(h)}</div>
                </div>
                <div className="mt-3">
                  <RelevanceMeter hit={h} />
                </div>
              </div>
              <div className="min-w-0">
                <button onClick={openReader} className="block w-full text-left">
                  <p className="font-serif text-[17px] leading-[1.65] text-parchment transition-colors group-hover:text-ivory">
                    {isOpen ? h.text : <Highlighted text={h.headline} />}
                  </p>
                </button>
                <div className="mt-3 flex items-center gap-5 font-mono text-[10.5px] tracking-[0.12em] uppercase">
                  <button onClick={openReader} className="text-brass hover:text-brass-bright">
                    Open at {pageRange(h)} →
                  </button>
                  <button
                    onClick={() =>
                      setExpanded((s) => {
                        const n = new Set(s);
                        if (n.has(h.chunkId)) n.delete(h.chunkId);
                        else n.add(h.chunkId);
                        return n;
                      })
                    }
                    className="text-muted hover:text-parchment"
                  >
                    {isOpen ? "Excerpt" : "Full passage"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border px-2.5 py-1 transition-colors ${active ? "border-brass-dim text-brass" : "border-line text-muted hover:text-parchment"}`}
    >
      {children}
    </button>
  );
}
