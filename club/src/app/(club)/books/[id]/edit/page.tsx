import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReader } from "@/lib/session";
import { getBook } from "@/lib/data/books";
import { coverSrc } from "@/lib/covers";
import { accession } from "@/lib/format";
import { BookForm } from "@/components/book/BookForm";

export const metadata: Metadata = { title: "Amend the record" };

export default async function EditBook({ params }: { params: Promise<{ id: string }> }) {
  await requireReader();
  const book = await getBook(Number((await params).id));
  if (!book) notFound();
  return (
    <div className="pt-8 md:pt-12">
      <Link href={`/books/${book.id}`} className="italic text-ink-soft hover:text-ink">
        ← back to the dossier
      </Link>
      <div className="label mt-6">Amending {accession(book.id)}</div>
      <h1 className="mt-2 font-display text-5xl">{book.title}</h1>
      <div className="mt-10">
        <BookForm book={book} coverPreview={coverSrc(book)} />
      </div>
    </div>
  );
}
