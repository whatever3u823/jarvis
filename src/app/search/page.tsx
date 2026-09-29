import type { Metadata } from "next";
import Link from "next/link";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchBox } from "@/components/SearchBox";
import { hybridSearch } from "@/lib/search/hybrid";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `“${q}”` : "Search" };
}

export default async function SearchPage({ searchParams }: Props) {
  const q = ((await searchParams).q ?? "").trim();
  if (!q) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-[14vh] md:px-8">
        <SearchBox variant="hero" autoFocus primary />
      </div>
    );
  }
  const t0 = Date.now();
  const hits = await hybridSearch(q, { limit: 30 });
  const ms = Date.now() - t0;
  const volumes = new Set(hits.map((h) => h.documentId)).size;

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-12 pb-24 md:px-8">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="label mb-3">Search</div>
          <h1 className="font-display text-[34px] leading-tight text-ivory italic md:text-[40px]">{q}</h1>
          <div className="mt-3 font-mono text-[11px] text-muted">
            {hits.length} passages · {volumes} {volumes === 1 ? "volume" : "volumes"} · {ms} ms
          </div>
        </div>
        <Link
          href={`/ask?q=${encodeURIComponent(q)}`}
          className="group shrink-0 border border-line-strong px-4 py-2.5 font-mono text-[11px] tracking-[0.14em] text-parchment uppercase transition-colors hover:border-brass-dim hover:text-brass"
        >
          Ask the library this <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </header>
      <SearchResults hits={hits} query={q} />
    </div>
  );
}
