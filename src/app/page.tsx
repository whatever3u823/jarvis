import { SearchBox } from "@/components/SearchBox";
import { LibraryView } from "@/components/library/LibraryView";
import { listDocuments } from "@/lib/documents";
import { formatNumber } from "@/lib/shared/format";
import { libraryStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [docs, stats] = await Promise.all([listDocuments(), libraryStats()]);
  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-8">
      <section className="mx-auto max-w-3xl pt-[12vh] pb-[9vh]">
        <div className="mb-6 flex items-center gap-3">
          <span className="h-px w-8 bg-brass-dim" />
          <span className="label">
            {formatNumber(stats.volumes)} {stats.volumes === 1 ? "volume" : "volumes"} · {formatNumber(stats.pages)} pages ·{" "}
            {formatNumber(stats.passages)} passages indexed
          </span>
        </div>
        <SearchBox variant="hero" primary autoFocus />
      </section>
      <div className="pb-24">
        <LibraryView initial={docs} />
      </div>
    </div>
  );
}
