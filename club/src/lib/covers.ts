import type { Book } from "@/lib/data/types";

/** Where a book's cover comes from: an upload, a pasted link, or Open Library by ISBN. */
export function coverSrc(book: Pick<Book, "id" | "cover_url" | "cover_version" | "isbn">): string | null {
  if (book.cover_version) return `/covers/${book.id}?v=${book.cover_version}`;
  if (book.cover_url) return book.cover_url;
  if (book.isbn) return `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg?default=false`;
  return null;
}
