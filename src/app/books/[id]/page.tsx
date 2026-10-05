import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookDetails } from "@/components/book/BookDetails";
import { BookWorkspace } from "@/components/book/BookWorkspace";
import { getDocument } from "@/lib/documents";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string; q?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Metadata must never take the page down (e.g. while the database is being set up).
  const doc = await getDocument((await params).id).catch(() => null);
  return { title: doc?.title ?? "Not found" };
}

export default async function BookPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const doc = await getDocument(id);
  if (!doc) notFound();
  const mode = sp.mode === "ask" || sp.mode === "search" ? sp.mode : undefined;

  return (
    <div className="mx-auto max-w-[1300px] px-4 pt-12 pb-24 md:px-8">
      <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        <header className="min-w-0 lg:col-start-2 lg:row-start-1">
          <div className="label mb-4 flex items-center gap-3">
            <span className="h-px w-8 bg-brass-dim" />
            Volume
          </div>
          <h1 className="font-display text-[36px] leading-[1.05] text-ivory md:text-[52px]">{doc.title}</h1>
          {doc.author && <div className="mt-3 font-serif text-[20px] text-parchment italic md:text-[21px]">{doc.author}</div>}
          {doc.description && <p className="mt-5 max-w-2xl font-serif text-[17px] leading-relaxed text-muted">{doc.description}</p>}
          {doc.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] tracking-wider text-muted uppercase">
              {doc.tags.map((t) => (
                <span key={t} className="border border-line px-2 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          )}
          <StatusNotice status={doc.status} detail={doc.statusDetail} />
        </header>

        <aside className="lg:sticky lg:top-24 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
          <BookDetails initial={doc} />
        </aside>

        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          <BookWorkspace doc={doc} initialMode={mode} initialQuery={sp.q} />
        </div>
      </div>
    </div>
  );
}

function StatusNotice({ status, detail }: { status: string; detail: string | null }) {
  if (status === "ready" && !detail) return null;
  const tone =
    status === "failed" ? "border-rust/60 text-rust" : status === "needs_ocr" ? "border-brass-dim text-brass" : status === "ready" ? "border-line-strong text-muted" : "border-brass-dim text-brass";
  const title =
    status === "failed"
      ? "Processing failed"
      : status === "needs_ocr"
        ? "Scanned document — not searchable yet"
        : status === "ready"
          ? "Note"
          : "Indexing in progress";
  return (
    <div className={`mt-6 max-w-2xl border-l pl-4 ${tone}`}>
      <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase">{title}</div>
      {detail && <p className="mt-1 text-[14px] leading-relaxed text-parchment">{detail}</p>}
      {status === "needs_ocr" && (
        <p className="mt-1 text-[13px] text-muted">
          The pages are images without a text layer, so there is nothing to index. Run the PDF through OCR (for example{" "}
          <code className="font-mono text-parchment">ocrmypdf in.pdf out.pdf</code>) and add the result. You can still read it here.
        </p>
      )}
    </div>
  );
}
