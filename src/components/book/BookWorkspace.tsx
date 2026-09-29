"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DocumentRecord } from "@/lib/documents";
import type { SearchHit } from "@/lib/search/hybrid";
import { AskPanel } from "../ask/AskPanel";
import { SearchBox, type SearchMode } from "../SearchBox";
import { SearchResults } from "../search/SearchResults";

type Tab = "contents" | "search" | "ask";

export function BookWorkspace({ doc, initialMode, initialQuery }: { doc: DocumentRecord; initialMode?: SearchMode; initialQuery?: string }) {
  const [tab, setTab] = useState<Tab>(initialMode ?? "contents");
  const [query, setQuery] = useState(initialMode === "search" ? (initialQuery ?? "") : "");
  const [askQuestion, setAskQuestion] = useState(initialMode === "ask" ? initialQuery : undefined);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [took, setTook] = useState<number | null>(null);
  // Searchable as soon as passages exist (also while a re-index is running).
  const ready = doc.status === "ready" || (doc.chunkCount ?? 0) > 0;

  const runSearch = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&doc=${doc.id}&limit=25`);
        const j = await r.json();
        setHits(j.hits ?? []);
        setTook(j.tookMs ?? null);
      } finally {
        setLoading(false);
      }
    },
    [doc.id],
  );

  useEffect(() => {
    if (initialMode === "search" && initialQuery && ready) void runSearch(initialQuery);
  }, [initialMode, initialQuery, ready, runSearch]);

  const syncUrl = (mode: SearchMode, q: string) => {
    const url = `/books/${doc.id}?mode=${mode}&q=${encodeURIComponent(q)}`;
    window.history.replaceState(null, "", url);
  };

  const onSubmit = (q: string, mode: SearchMode) => {
    syncUrl(mode, q);
    if (mode === "search") {
      setTab("search");
      setQuery(q);
      void runSearch(q);
    } else {
      setTab("ask");
      setAskQuestion(q);
    }
  };

  return (
    <section>
      {ready && (
        <div className="mb-8">
          <SearchBox
            variant="bar"
            scope={{ documentId: doc.id, title: doc.title }}
            initialMode={tab === "ask" ? "ask" : "search"}
            initialQuery={tab === "search" ? query : ""}
            onSubmit={onSubmit}
          />
        </div>
      )}

      <div className="mb-8 flex gap-6 border-b border-line font-mono text-[11px] tracking-[0.14em] uppercase">
        {(
          [
            ["contents", "Contents"],
            ["search", "Search within"],
            ["ask", "Ask this volume"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            disabled={!ready && t !== "contents"}
            className={`-mb-px border-b pb-3 transition-colors disabled:opacity-30 ${tab === t ? "border-brass text-ivory" : "border-transparent text-muted hover:text-parchment"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={tab === "contents" ? "" : "hidden"}>
        <Contents doc={doc} />
      </div>

      {tab === "search" && (
        <div>
          {loading && <div className="label animate-pulse-soft py-6">Searching this volume</div>}
          {!loading && hits && (
            <>
              <div className="mb-4 font-mono text-[11px] text-muted">
                {hits.length} passages for “{query}”{took !== null ? ` · ${took} ms` : ""}
              </div>
              <SearchResults hits={hits} query={query} scoped />
            </>
          )}
          {!loading && !hits && <p className="py-6 font-serif text-[17px] text-muted">Search this volume by meaning or by exact words.</p>}
        </div>
      )}

      {/* Kept mounted so a running answer survives switching tabs. */}
      <div className={tab === "ask" ? "" : "hidden"}>
        {ready && <AskPanel scope={{ documentIds: [doc.id], title: doc.title }} initialQuestion={askQuestion} />}
      </div>
    </section>
  );
}

function Contents({ doc }: { doc: DocumentRecord }) {
  if (doc.outline.length === 0) {
    return (
      <div className="py-4">
        <p className="font-serif text-[17px] text-muted">
          {doc.status === "ready"
            ? "No chapter structure could be detected in this PDF. Browse it page by page instead."
            : "Contents will appear once the volume has been indexed."}
        </p>
        {doc.pageCount ? <PageStrip doc={doc} /> : null}
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="label">{doc.outlineSource === "pdf" ? "From the document's outline" : "Detected from headings"}</span>
        <span className="font-mono text-[10.5px] text-faint">page</span>
      </div>
      <ol className="border-t border-line">
        {doc.outline.map((o, i) => {
          const leaf = o.title.split(" › ").pop()!;
          return (
            <li key={i}>
              <Link
                href={`/books/${doc.id}/read?page=${o.page}`}
                className="group flex items-baseline gap-4 border-b border-line/70 py-2.5 transition-colors hover:bg-panel"
                style={{ paddingLeft: `${Math.min(o.level, 3) * 1.25}rem` }}
              >
                <span className={`min-w-0 flex-1 font-serif ${o.level === 0 ? "text-[17px] text-ivory" : "text-[15.5px] text-parchment"} group-hover:text-brass-bright`}>
                  {leaf}
                </span>
                <span className="h-px min-w-6 flex-none translate-y-[-0.3em] bg-line" />
                <span className="font-mono text-[11px] text-muted group-hover:text-brass">{o.page}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      {doc.pageCount ? <PageStrip doc={doc} /> : null}
    </div>
  );
}

/** Jump to any page: a compact strip of page ranges. */
function PageStrip({ doc }: { doc: DocumentRecord }) {
  const n = doc.pageCount ?? 0;
  const step = n > 400 ? 50 : n > 150 ? 25 : 10;
  const starts: number[] = [];
  for (let p = 1; p <= n; p += step) starts.push(p);
  return (
    <div className="mt-8">
      <div className="label mb-3">Browse pages</div>
      <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
        {starts.map((s) => (
          <Link
            key={s}
            href={`/books/${doc.id}/read?page=${s}`}
            className="rounded-xs border border-line px-2 py-1 text-muted transition-colors hover:border-brass-dim hover:text-brass"
          >
            {s}–{Math.min(n, s + step - 1)}
          </Link>
        ))}
      </div>
    </div>
  );
}
