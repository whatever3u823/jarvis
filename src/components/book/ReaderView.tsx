"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DocumentRecord } from "@/lib/documents";
import { PdfReader } from "../reader/PdfReader";

/** Full-page reader with a contents rail; the current page is mirrored in the URL. */
export function ReaderView({ doc, page, chunkId }: { doc: DocumentRecord; page: number; chunkId: number | null }) {
  const [current, setCurrent] = useState(page);
  const [target, setTarget] = useState<{ page: number; chunkId: number | null; nonce?: number }>({ page, chunkId });
  const [rail, setRail] = useState(true);

  const onPageChange = (p: number) => {
    setCurrent(p);
    window.history.replaceState(null, "", `/books/${doc.id}/read?page=${p}`);
  };

  const activeIdx = useMemo(() => {
    let idx = -1;
    doc.outline.forEach((o, i) => {
      if (o.page <= current) idx = i;
    });
    return idx;
  }, [doc.outline, current]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      {rail && doc.outline.length > 0 && (
        <nav className="hidden w-72 shrink-0 overflow-y-auto border-r border-line bg-panel/60 lg:block">
          <div className="sticky top-0 border-b border-line bg-panel px-5 py-4">
            <Link href={`/books/${doc.id}`} className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase hover:text-ivory">
              ← Volume
            </Link>
            <div className="mt-2 font-display text-[19px] leading-tight text-ivory">{doc.title}</div>
            {doc.author && <div className="mt-0.5 font-serif text-[14px] text-muted italic">{doc.author}</div>}
          </div>
          <ol className="py-2">
            {doc.outline.map((o, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    setTarget({ page: o.page, chunkId: null, nonce: Date.now() });
                    onPageChange(o.page);
                  }}
                  className={`flex w-full items-baseline gap-3 py-1.5 pr-4 text-left transition-colors hover:bg-hover ${i === activeIdx ? "text-brass" : "text-parchment"}`}
                  style={{ paddingLeft: `${1.25 + Math.min(o.level, 3) * 0.9}rem` }}
                >
                  <span className="min-w-0 flex-1 font-serif text-[14px] leading-snug">{o.title.split(" › ").pop()}</span>
                  <span className="font-mono text-[10px] text-faint">{o.page}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-2 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase lg:hidden">
          <Link href={`/books/${doc.id}`} className="hover:text-ivory">
            ← {doc.title.length > 40 ? doc.title.slice(0, 38) + "…" : doc.title}
          </Link>
        </div>
        {doc.outline.length > 0 && (
          <button onClick={() => setRail((v) => !v)} className="hidden border-b border-line px-4 py-1.5 text-left font-mono text-[10px] tracking-[0.14em] text-faint uppercase hover:text-parchment lg:block">
            {rail ? "Hide contents" : "Show contents"}
          </button>
        )}
        <div className="min-h-0 flex-1">
          <PdfReader documentId={doc.id} target={target} pageCount={doc.pageCount} onPageChange={onPageChange} />
        </div>
      </div>
    </div>
  );
}
