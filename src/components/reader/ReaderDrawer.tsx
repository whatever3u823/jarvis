"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { chapterLeaf } from "@/lib/shared/format";

const PdfReader = dynamic(() => import("./PdfReader").then((m) => m.PdfReader), { ssr: false });

export interface OpenReaderArgs {
  documentId: string;
  title: string;
  author?: string | null;
  chapter?: string | null;
  page: number;
  pageLabel?: string;
  chunkId?: number | null;
  text?: string | null;
}

const ReaderContext = createContext<{ open: (a: OpenReaderArgs) => void; close: () => void } | null>(null);

export function useReader() {
  const ctx = useContext(ReaderContext);
  if (!ctx) throw new Error("useReader must be used inside <ReaderProvider>");
  return ctx;
}

/** A slide-over reader: search result → source page without leaving the current view. */
export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<(OpenReaderArgs & { nonce: number }) | null>(null);
  const [page, setPage] = useState(1);

  const open = useCallback((a: OpenReaderArgs) => {
    setCurrent({ ...a, nonce: Date.now() });
    setPage(a.page);
  }, []);
  const close = useCallback(() => setCurrent(null), []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, close]);

  const value = useMemo(() => ({ open, close }), [open, close]);
  const target = useMemo(
    () => (current ? { page: current.page, chunkId: current.chunkId, text: current.text, nonce: current.nonce } : null),
    [current],
  );

  const fullHref = current
    ? `/books/${current.documentId}/read?page=${page}${current.chunkId && page === current.page ? `&chunk=${current.chunkId}` : ""}`
    : "#";

  return (
    <ReaderContext.Provider value={value}>
      {children}
      {current && target && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label={`Reader: ${current.title}`}>
          <button aria-label="Close reader" className="absolute inset-0 animate-fade-in bg-black/55" onClick={close} />
          <aside className="relative flex h-full w-full max-w-[860px] animate-slide-in flex-col border-l border-line-strong bg-panel shadow-2xl md:w-[62vw]">
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 pt-4 pb-3">
              <div className="min-w-0">
                <div className="label mb-1">Source</div>
                <h2 className="truncate font-display text-[22px] leading-tight text-ivory">{current.title}</h2>
                <div className="mt-1 truncate font-mono text-[11px] text-muted">
                  {[current.author, chapterLeaf(current.chapter), `page ${page}`].filter(Boolean).join("  ·  ")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 pt-1 font-mono text-[11px] tracking-wide uppercase">
                <Link href={`/books/${current.documentId}`} onClick={close} className="text-muted hover:text-ivory">
                  Volume
                </Link>
                <Link href={fullHref} onClick={close} className="text-brass hover:text-brass-bright">
                  Full reader ↗
                </Link>
                <button onClick={close} aria-label="Close" className="ml-1 text-lg leading-none text-muted hover:text-ivory">
                  ×
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1">
              <PdfReader key={current.documentId} documentId={current.documentId} target={target} onPageChange={setPage} compact />
            </div>
          </aside>
        </div>
      )}
    </ReaderContext.Provider>
  );
}
