import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReaderView } from "@/components/book/ReaderView";
import { getDocument } from "@/lib/documents";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; chunk?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Metadata must never take the page down (e.g. while the database is being set up).
  const doc = await getDocument((await params).id).catch(() => null);
  return { title: doc ? `Reading · ${doc.title}` : "Not found" };
}

export default async function ReadPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const doc = await getDocument(id);
  if (!doc) notFound();
  const page = Math.max(1, Math.min(Number(sp.page) || 1, doc.pageCount ?? Number.MAX_SAFE_INTEGER));
  const chunk = sp.chunk && /^\d+$/.test(sp.chunk) ? Number(sp.chunk) : null;
  return <ReaderView doc={doc} page={page} chunkId={chunk} />;
}
