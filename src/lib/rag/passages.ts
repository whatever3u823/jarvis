import { db } from "../db";
import type { SearchHit } from "../search/hybrid";
import { pageRange } from "../shared/format";

/**
 * Every piece of text the model sees gets a short, server-issued ID (P1, P2…)
 * bound to its exact source (document, page range, chunk). The model cites
 * those IDs; the UI resolves them to "[Title, p. 42]". Because IDs only exist
 * for text that was actually retrieved, a citation can never point at a page
 * the model did not see.
 */

export interface Passage {
  id: string;
  kind: "chunk" | "page";
  chunkId: number | null;
  documentId: string;
  bookRef: string;
  title: string;
  author: string | null;
  chapter: string | null;
  pageStart: number;
  pageEnd: number;
  pageLabelStart: string | null;
  pageLabelEnd: string | null;
  text: string;
}

/** Client-held reference to a passage from an earlier turn. */
export interface PassageRef {
  id: string;
  chunkId: number | null;
  documentId: string;
  page: number;
}

export interface BookInfo {
  id: string;
  ref: string;
  title: string;
  author: string | null;
  pageCount: number | null;
  outline: { title: string; page: number; level: number }[];
}

export class PassageRegistry {
  private byKey = new Map<string, Passage>();
  private byId = new Map<string, Passage>();
  private next = 1;

  constructor(private books: Map<string, BookInfo>) {}

  get size() {
    return this.byId.size;
  }

  get(id: string): Passage | undefined {
    return this.byId.get(id);
  }

  all(): Passage[] {
    return [...this.byId.values()];
  }

  private key(p: { kind: string; chunkId: number | null; documentId: string; pageStart: number }) {
    return p.kind === "chunk" ? `c:${p.chunkId}` : `p:${p.documentId}:${p.pageStart}`;
  }

  /** Register (or look up) a passage; returns it with its stable ID. */
  add(p: Omit<Passage, "id" | "bookRef">, forcedId?: string): { passage: Passage; isNew: boolean } {
    const k = this.key(p);
    const existing = this.byKey.get(k);
    if (existing) return { passage: existing, isNew: false };
    let id = forcedId;
    if (!id || this.byId.has(id)) id = `P${this.next}`;
    const num = Number(id.slice(1));
    if (num >= this.next) this.next = num + 1;
    const passage: Passage = { ...p, id, bookRef: this.books.get(p.documentId)?.ref ?? "?" };
    this.byKey.set(k, passage);
    this.byId.set(id, passage);
    return { passage, isNew: true };
  }

  addHit(h: SearchHit) {
    return this.add({
      kind: "chunk",
      chunkId: h.chunkId,
      documentId: h.documentId,
      title: h.title,
      author: h.author,
      chapter: h.chapter,
      pageStart: h.pageStart,
      pageEnd: h.pageEnd,
      pageLabelStart: h.pageLabelStart,
      pageLabelEnd: h.pageLabelEnd,
      text: h.text,
    });
  }
}

export { pageRange };

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** How a passage is shown to the model. */
export function formatPassage(p: Passage): string {
  const attrs = [
    `id="${p.id}"`,
    `book="${p.bookRef}"`,
    `title="${escapeAttr(p.title)}"`,
    p.author ? `author="${escapeAttr(p.author)}"` : null,
    `pages="${pageRange(p)}"`,
    p.chapter ? `chapter="${escapeAttr(p.chapter)}"` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return `<passage ${attrs}>\n${p.text}\n</passage>`;
}

/** Load books (all ready ones, or the given scope) and give them short refs B1, B2… */
export async function loadBooks(documentIds?: string[]): Promise<Map<string, BookInfo>> {
  const scoped = documentIds && documentIds.length > 0;
  const { rows } = await db().query(
    `select id, title, author, page_count, outline from documents
     where coalesce(chunk_count, 0) > 0 ${scoped ? "and id = any($1::uuid[])" : ""}
     order by coalesce(author, ''), title`,
    scoped ? [documentIds] : [],
  );
  const books = new Map<string, BookInfo>();
  rows.forEach((r, i) =>
    books.set(r.id, {
      id: r.id,
      ref: `B${i + 1}`,
      title: r.title,
      author: r.author,
      pageCount: r.page_count,
      outline: r.outline ?? [],
    }),
  );
  return books;
}

/** Re-hydrate passages cited in earlier turns from the database (never trusting client text). */
export async function restorePassages(registry: PassageRegistry, refs: PassageRef[]): Promise<void> {
  const chunkRefs = refs.filter((r) => r.chunkId != null);
  const pageRefs = refs.filter((r) => r.chunkId == null);
  if (chunkRefs.length) {
    const { rows } = await db().query(
      `select c.id, c.document_id, c.page_start, c.page_end, c.chapter, c.text, d.title, d.author,
              ps.label as label_start, pe.label as label_end
       from chunks c join documents d on d.id = c.document_id
       left join pages ps on ps.document_id = c.document_id and ps.page = c.page_start
       left join pages pe on pe.document_id = c.document_id and pe.page = c.page_end
       where c.id = any($1::bigint[])`,
      [chunkRefs.map((r) => r.chunkId)],
    );
    const byChunk = new Map(rows.map((r) => [Number(r.id), r]));
    for (const ref of chunkRefs) {
      const r = byChunk.get(Number(ref.chunkId));
      if (!r) continue;
      registry.add(
        {
          kind: "chunk",
          chunkId: Number(r.id),
          documentId: r.document_id,
          title: r.title,
          author: r.author,
          chapter: r.chapter,
          pageStart: r.page_start,
          pageEnd: r.page_end,
          pageLabelStart: r.label_start,
          pageLabelEnd: r.label_end,
          text: r.text,
        },
        ref.id,
      );
    }
  }
  for (const ref of pageRefs) {
    const passages = await readPagePassages(ref.documentId, ref.page, ref.page);
    if (passages[0]) registry.add(passages[0], ref.id);
  }
}

/** Full page text as passages (for reading around a hit). */
export async function readPagePassages(documentId: string, from: number, to: number): Promise<Omit<Passage, "id" | "bookRef">[]> {
  const { rows } = await db().query(
    `select p.page, p.label, p.text, d.title, d.author
     from pages p join documents d on d.id = p.document_id
     where p.document_id = $1 and p.page between $2 and $3 order by p.page`,
    [documentId, from, to],
  );
  const chapters = await db().query(
    `select distinct on (page_start) page_start, chapter from chunks
     where document_id = $1 and page_start <= $2 order by page_start desc, ordinal desc limit 1`,
    [documentId, to],
  );
  const chapter = chapters.rows[0]?.chapter ?? null;
  return rows
    .filter((r) => r.text.trim().length > 0)
    .map((r) => ({
      kind: "page" as const,
      chunkId: null,
      documentId,
      title: r.title,
      author: r.author,
      chapter,
      pageStart: r.page,
      pageEnd: r.page,
      pageLabelStart: r.label,
      pageLabelEnd: r.label,
      text: r.text,
    }));
}
