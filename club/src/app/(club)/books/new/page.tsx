import type { Metadata } from "next";
import { requireReader } from "@/lib/session";
import { BookForm } from "@/components/book/BookForm";

export const metadata: Metadata = { title: "Accession a book" };

export default async function NewBook() {
  await requireReader();
  return (
    <div className="pt-8 md:pt-12">
      <div className="label">Accession card</div>
      <h1 className="mt-2 font-display text-5xl">A new book comes home</h1>
      <p className="mt-2 text-lg italic text-ink-soft">Fill in what you know. The rest can be pencilled in later.</p>
      <div className="mt-10">
        <BookForm />
      </div>
    </div>
  );
}
