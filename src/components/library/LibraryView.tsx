"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentRecord } from "@/lib/documents";
import { formatDate, STATUS_LABEL } from "@/lib/shared/format";
import { LIBRARY_CHANGED, useUpload } from "../UploadProvider";
import { BookCover } from "./BookCover";

type Sort = "recent" | "title" | "author" | "length";
type View = "shelf" | "index";
type StatusFilter = "all" | "ready" | "attention";

function sortKeyAuthor(d: DocumentRecord) {
  // Sort by surname when the author looks like "First Last".
  const a = (d.author ?? "").trim();
  if (!a) return "￿";
  const parts = a.split(/\s+/);
  return (parts.length > 1 && !a.includes(",") ? parts[parts.length - 1] + " " + a : a).toLowerCase();
}

export function LibraryView({ initial }: { initial: DocumentRecord[] }) {
  const { pickFiles } = useUpload();
  const [docs, setDocs] = useState(initial);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<View>("shelf");
  const [tag, setTag] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => setDocs(initial), [initial]);

  useEffect(() => {
    try {
      const v = localStorage.getItem("jarvis.library.view");
      const s = localStorage.getItem("jarvis.library.sort");
      if (v === "shelf" || v === "index") setView(v);
      if (s === "recent" || s === "title" || s === "author" || s === "length") setSort(s);
    } catch {}
  }, []);
  const persist = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  };

  // Poll while anything is being indexed.
  const busy = docs.some((d) => d.status === "queued" || d.status === "processing");
  const lastNudge = useRef(0);
  useEffect(() => {
    const refresh = () =>
      fetch("/api/documents")
        .then((r) => r.json())
        .then((j: { documents: DocumentRecord[] }) => {
          setDocs(j.documents);
          // Without a background worker (hosted), a volume left waiting, e.g.
          // after a function timed out, is picked up again by nudging the queue.
          const stale = j.documents.some(
            (d) => (d.status === "queued" || d.status === "processing") && Date.now() - Date.parse(d.updatedAt) > 45_000,
          );
          if (stale && Date.now() - lastNudge.current > 60_000) {
            lastNudge.current = Date.now();
            void fetch("/api/jobs/run", { method: "POST" }).catch(() => {});
          }
        })
        .catch(() => {});
    window.addEventListener(LIBRARY_CHANGED, refresh);
    const t = busy ? setInterval(refresh, 1500) : null;
    return () => {
      window.removeEventListener(LIBRARY_CHANGED, refresh);
      if (t) clearInterval(t);
    };
  }, [busy]);

  const tags = useMemo(() => [...new Set(docs.flatMap((d) => d.tags))].sort(), [docs]);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let xs = docs.filter(
      (d) =>
        (!f || d.title.toLowerCase().includes(f) || (d.author ?? "").toLowerCase().includes(f) || d.tags.some((t) => t.includes(f))) &&
        (!tag || d.tags.includes(tag)) &&
        (status === "all" || (status === "ready" ? d.status === "ready" : d.status !== "ready")),
    );
    xs = [...xs].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "author":
          return sortKeyAuthor(a).localeCompare(sortKeyAuthor(b)) || a.title.localeCompare(b.title);
        case "length":
          return (b.pageCount ?? 0) - (a.pageCount ?? 0);
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return xs;
  }, [docs, filter, sort, tag, status]);

  const attention = docs.filter((d) => d.status !== "ready").length;

  if (docs.length === 0) {
    return (
      <button
        onClick={pickFiles}
        className="group flex w-full flex-col items-center justify-center border border-dashed border-line-strong px-8 py-24 text-center transition-colors hover:border-brass-dim"
      >
        <span className="label mb-4">The shelves are empty</span>
        <span className="font-display text-3xl text-parchment group-hover:text-ivory">Drop a PDF anywhere to begin</span>
        <span className="mt-3 font-mono text-[11px] text-faint">or click to choose files · books, papers, anything with a text layer</span>
      </button>
    );
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-baseline gap-4">
          <h2 className="font-display text-[28px] leading-none text-ivory">The Collection</h2>
          <span className="font-mono text-[11px] text-muted">
            {shown.length === docs.length ? docs.length : `${shown.length} of ${docs.length}`} {docs.length === 1 ? "volume" : "volumes"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by title, author, tag"
            className="w-52 rounded-sm border border-line bg-panel px-2.5 py-1.5 text-[12px] text-ivory outline-none placeholder:text-faint focus:border-brass-dim"
          />
          <Segmented
            value={sort}
            onChange={(v) => {
              setSort(v);
              persist("jarvis.library.sort", v);
            }}
            options={[
              ["recent", "Recent"],
              ["title", "Title"],
              ["author", "Author"],
              ["length", "Length"],
            ]}
          />
          <Segmented
            value={view}
            onChange={(v) => {
              setView(v);
              persist("jarvis.library.view", v);
            }}
            options={[
              ["shelf", "Shelf"],
              ["index", "Index"],
            ]}
          />
        </div>
      </div>

      {(tags.length > 0 || attention > 0) && (
        <div className="mb-6 flex flex-wrap items-center gap-2 font-mono text-[10.5px] tracking-wider uppercase">
          {attention > 0 && (
            <Chip active={status === "attention"} onClick={() => setStatus(status === "attention" ? "all" : "attention")}>
              In progress / needs attention · {attention}
            </Chip>
          )}
          {tags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </Chip>
          ))}
        </div>
      )}

      {view === "shelf" ? (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map((d, i) => (
            <li key={d.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <ShelfCard doc={d} />
            </li>
          ))}
        </ul>
      ) : (
        <IndexTable docs={shown} />
      )}
    </section>
  );
}

function ShelfCard({ doc }: { doc: DocumentRecord }) {
  const working = doc.status === "queued" || doc.status === "processing";
  return (
    <Link href={`/books/${doc.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden border border-line bg-panel transition-[border-color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:border-line-strong">
        <BookCover doc={doc} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        {doc.status !== "ready" && (
          <div className="absolute inset-x-0 bottom-0 bg-ink/90 px-2.5 py-2">
            <div className={`font-mono text-[9.5px] tracking-[0.12em] uppercase ${doc.status === "failed" ? "text-rust" : doc.status === "needs_ocr" ? "text-brass" : "text-parchment"}`}>
              {working && doc.stage ? stageLabel(doc.stage) : STATUS_LABEL[doc.status]}
            </div>
            {working && (
              <div className="mt-1.5 h-px w-full bg-line">
                <div className="h-px bg-brass transition-[width] duration-500" style={{ width: `${Math.round((doc.progress ?? 0) * 100)}%` }} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="line-clamp-2 font-serif text-[15.5px] leading-snug text-ivory group-hover:text-brass-bright">{doc.title}</div>
        {doc.author && <div className="mt-0.5 truncate text-[12.5px] text-muted">{doc.author}</div>}
        <div className="mt-1.5 font-mono text-[10px] tracking-wide text-faint uppercase">
          {doc.pageCount ? `${doc.pageCount} pp · ` : ""}
          {doc.fileType} · {formatDate(doc.createdAt)}
        </div>
      </div>
    </Link>
  );
}

function stageLabel(stage: string) {
  return (
    { queued: "Queued", reading: "Opening", extracting: "Extracting text", embedding: "Indexing passages" } as Record<string, string>
  )[stage] ?? stage;
}

function IndexTable({ docs }: { docs: DocumentRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {["Title", "Author", "Pages", "Passages", "Status", "Added"].map((h) => (
              <th key={h} className="label py-2 pr-4 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className="group border-b border-line/70 transition-colors hover:bg-panel">
              <td className="py-2.5 pr-4">
                <Link href={`/books/${d.id}`} className="flex items-center gap-3">
                  <span className="block h-10 w-7 shrink-0 overflow-hidden border border-line">
                    <BookCover doc={d} size="sm" />
                  </span>
                  <span className="font-serif text-[15px] text-ivory group-hover:text-brass-bright">{d.title}</span>
                </Link>
              </td>
              <td className="py-2.5 pr-4 text-[13px] text-parchment">{d.author ?? <span className="text-faint">—</span>}</td>
              <td className="py-2.5 pr-4 font-mono text-[12px] text-muted">{d.pageCount ?? "—"}</td>
              <td className="py-2.5 pr-4 font-mono text-[12px] text-muted">{d.chunkCount ?? "—"}</td>
              <td className={`py-2.5 pr-4 font-mono text-[11px] tracking-wide uppercase ${d.status === "ready" ? "text-faint" : d.status === "failed" ? "text-rust" : "text-brass"}`}>
                {STATUS_LABEL[d.status]}
                {(d.status === "processing" || d.status === "queued") && ` ${Math.round(d.progress * 100)}%`}
              </td>
              <td className="py-2.5 font-mono text-[12px] text-muted">{formatDate(d.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-sm border border-line">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`px-2.5 py-1.5 tracking-wider uppercase transition-colors ${value === v ? "bg-raised text-ivory" : "text-muted hover:text-parchment"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border px-2.5 py-1 transition-colors ${active ? "border-brass-dim text-brass" : "border-line text-muted hover:text-parchment"}`}
    >
      {children}
    </button>
  );
}
