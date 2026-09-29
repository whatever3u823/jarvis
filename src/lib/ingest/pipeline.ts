import { config } from "../config";
import { db, toVector, withTransaction } from "../db";
import { metadataFromFileName } from "../documents";
import { getEmbedder } from "../embed";
import { renderCover } from "../pdf/cover";
import { extractPdf, openPdf, type Extraction } from "../pdf/extract";
import { keys, storage } from "../storage";
import { chunkParagraphs, type Chunk } from "./chunk";

/**
 * PDF -> text extraction (page-aware) -> chunking -> embeddings -> Postgres
 * (pgvector + full-text). Idempotent: re-running replaces pages and chunks.
 */

/** Below this share of pages with a text layer, treat the PDF as a scan. */
const MIN_TEXT_PAGE_RATIO = 0.1;

async function setProgress(id: string, stage: string, progress: number, detail?: string | null) {
  await db().query(
    `update documents set stage = $2, progress = $3, status_detail = coalesce($4, status_detail), updated_at = now() where id = $1`,
    [id, stage, Math.max(0, Math.min(1, progress)), detail ?? null],
  );
}

const JUNK_TITLE = /^(untitled|microsoft word|document\d*|title|none|null)\b|\.(docx?|pdf|indd|tex|dvi|rtf|odt|qxd|p65)$/i;
const JUNK_AUTHOR = /^(user|admin|administrator|owner|unknown|author|anonymous|none|null|\d+)$/i;

export function chooseMetadata(fileName: string, ex: Extraction): { title: string; author: string | null } {
  const fromFile = metadataFromFileName(fileName);
  // "Title by Author.pdf" is a deliberate naming; trust it over embedded metadata.
  if (fromFile.author) return fromFile;
  const infoTitle = ex.info.title && ex.info.title.length >= 3 && ex.info.title.length <= 200 && !JUNK_TITLE.test(ex.info.title)
    ? ex.info.title
    : null;
  const infoAuthor = ex.info.author && ex.info.author.length <= 120 && !JUNK_AUTHOR.test(ex.info.author)
    ? ex.info.author
    : null;
  return {
    title: infoTitle ?? ex.typographicTitle ?? fromFile.title,
    author: infoAuthor ?? fromFile.author,
  };
}

/** The text that gets embedded: a short contextual header plus the passage. */
export function embeddingText(title: string, author: string | null, chunk: Pick<Chunk, "chapter" | "text">): string {
  const chapter = chunk.chapter?.split(" › ").pop();
  const head = [author, title].filter(Boolean).join(", ") + (chapter ? ` — ${chapter}` : "");
  return `${head}\n\n${chunk.text}`;
}

export async function ingestDocument(documentId: string, log: (msg: string) => void = () => {}): Promise<void> {
  const { rows } = await db().query(
    `select id, file_name, title, author, metadata_edited from documents where id = $1`,
    [documentId],
  );
  const doc = rows[0];
  if (!doc) throw new Error(`Document ${documentId} not found`);

  await db().query(
    `update documents set status = 'processing', stage = 'reading', progress = 0, status_detail = null, updated_at = now() where id = $1`,
    [documentId],
  );

  const bytes = new Uint8Array(await storage.get(keys.original(documentId)));
  let pdf;
  try {
    pdf = await openPdf(bytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const detail = /password/i.test(msg)
      ? "This PDF is password-protected and cannot be read."
      : `The file could not be opened as a PDF (${msg}).`;
    await db().query(`update documents set status = 'failed', status_detail = $2, stage = null, updated_at = now() where id = $1`, [documentId, detail]);
    return;
  }

  try {
    // Cover
    let hasCover = false;
    try {
      await storage.put(keys.cover(documentId), await renderCover(pdf));
      hasCover = true;
    } catch (err) {
      log(`cover rendering failed: ${err instanceof Error ? err.message : err}`);
    }

    // Text
    await setProgress(documentId, "extracting", 0);
    let lastWrite = 0;
    const ex = await extractPdf(pdf, (done, total) => {
      const now = Date.now();
      if (now - lastWrite > 500 || done === total) {
        lastWrite = now;
        void setProgress(documentId, "extracting", done / total, `Extracting text · page ${done} of ${total}`);
      }
    });
    const textPages = ex.pageCount - ex.emptyPages.length;
    log(`extracted ${ex.pageCount} pages (${textPages} with text), outline: ${ex.outlineSource}`);

    const meta = doc.metadata_edited ? { title: doc.title, author: doc.author } : chooseMetadata(doc.file_name, ex);

    await withTransaction(async (c) => {
      await c.query("delete from pages where document_id = $1", [documentId]);
      await c.query(
        `insert into pages (document_id, page, label, text, char_count)
         select $1, * from unnest($2::int[], $3::text[], $4::text[], $5::int[])`,
        [
          documentId,
          ex.pages.map((p) => p.page),
          ex.pages.map((p) => p.label),
          ex.pages.map((p) => p.text),
          ex.pages.map((p) => p.charCount),
        ],
      );
      await c.query(
        `update documents set title = $2, author = $3, page_count = $4, text_pages = $5, has_cover = $6,
           outline = $7, outline_source = $8, pdf_info = $9, updated_at = now() where id = $1`,
        [documentId, meta.title, meta.author, ex.pageCount, textPages, hasCover, JSON.stringify(ex.outline), ex.outlineSource, JSON.stringify(ex.info)],
      );
    });

    // Scanned / image-only PDFs: say so explicitly instead of indexing nothing.
    if (textPages === 0 || textPages / ex.pageCount < MIN_TEXT_PAGE_RATIO) {
      await db().query("delete from chunks where document_id = $1", [documentId]);
      await db().query(
        `update documents set status = 'needs_ocr', stage = null, progress = 1, chunk_count = 0, processed_at = now(), updated_at = now(),
           status_detail = $2 where id = $1`,
        [
          documentId,
          textPages === 0
            ? `No text layer found on any of the ${ex.pageCount} pages. This looks like a scanned or image-only PDF; it needs OCR before it can be searched.`
            : `Only ${textPages} of ${ex.pageCount} pages have a text layer. This looks like a scanned PDF; it needs OCR before it can be searched.`,
        ],
      );
      log("no usable text layer; marked needs_ocr");
      return;
    }

    // Chunks + embeddings
    const chunks = chunkParagraphs(ex.paragraphs);
    const embedder = getEmbedder();
    const vectors: number[][] = [];
    const batch = 32;
    for (let i = 0; i < chunks.length; i += batch) {
      const slice = chunks.slice(i, i + batch);
      vectors.push(...(await embedder.embedDocuments(slice.map((c) => embeddingText(meta.title, meta.author, c)))));
      const done = Math.min(i + batch, chunks.length);
      await setProgress(documentId, "embedding", done / chunks.length, `Indexing passages · ${done} of ${chunks.length}`);
    }

    await withTransaction(async (c) => {
      await c.query("delete from chunks where document_id = $1", [documentId]);
      const step = 200;
      for (let i = 0; i < chunks.length; i += step) {
        const part = chunks.slice(i, i + step);
        await c.query(
          `insert into chunks (document_id, ordinal, page_start, page_end, chapter, text, word_count, embedding)
           select $1, o, ps, pe, ch, tx, wc, emb::vector
           from unnest($2::int[], $3::int[], $4::int[], $5::text[], $6::text[], $7::int[], $8::text[])
             as t(o, ps, pe, ch, tx, wc, emb)`,
          [
            documentId,
            part.map((x) => x.ordinal),
            part.map((x) => x.pageStart),
            part.map((x) => x.pageEnd),
            part.map((x) => x.chapter),
            part.map((x) => x.text),
            part.map((x) => x.wordCount),
            part.map((_, j) => toVector(vectors[i + j])),
          ],
        );
      }
      const emptyNote =
        ex.emptyPages.length > 0
          ? `${ex.emptyPages.length} of ${ex.pageCount} pages had no extractable text (blank or image-only pages).`
          : null;
      await c.query(
        `update documents set status = 'ready', stage = null, progress = 1, chunk_count = $2, embedding_model = $3,
           status_detail = $4, processed_at = now(), updated_at = now() where id = $1`,
        [documentId, chunks.length, config.embeddingModel, emptyNote],
      );
    });
    log(`indexed ${chunks.length} passages`);
  } finally {
    await pdf.loadingTask.destroy();
  }
}
