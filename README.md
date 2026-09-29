# Jarvis — a private library

A personal web application for a library of PDFs (mostly books). Upload a book and it is read, split into passages, indexed for semantic and keyword search, and made answerable: ask a question of one volume or of the whole library and get an answer grounded in the text, with every claim tied to a passage you can open at its page.

The rule the whole system is built around: **answers come from your library, not from the model's general knowledge**, and a citation can only ever point at text that was actually retrieved.

---

## Quick start

Requirements: Node.js ≥ 20.9, and Docker (for Postgres + pgvector) or a local PostgreSQL 16 with the `vector` extension.

```bash
npm install
docker compose up -d            # Postgres 16 + pgvector on localhost:5432
cp .env.example .env            # then set ANTHROPIC_API_KEY
npm run db:migrate
npm run models:fetch            # local embedding model (~230–440 MB), one time
npm run dev                     # web app + ingestion worker → http://localhost:3000
```

Drop a PDF anywhere on the page (or use **+ Add**). Indexing runs in the background; a 200-page book takes about a minute on a laptop CPU. To import a folder from the command line:

```bash
npm run ingest -- ~/Books/*.pdf
```

Search works without an API key. Answering questions needs `ANTHROPIC_API_KEY`; without it, Ask shows the retrieved passages and says why there is no answer.

For everyday use, `npm run build && npm start` runs the production build (web + worker). Both bind to `127.0.0.1` only: there is no login, so don't expose the app to a network you don't trust.

---

## What it does

| | |
|---|---|
| **Library** | Shelf and index views of every volume: cover (rendered from page 1), title, author, pages, date added, status, tags. Sort by recent / title / author / length; filter by text, tag, status. |
| **Upload** | Drag and drop anywhere. Duplicates are detected by content hash. Progress is shown live (extracting → indexing passages). Scanned PDFs with no text layer are flagged **Needs OCR** with an explanation instead of silently indexing nothing. |
| **Search** | One box, everywhere (`/` or `⌘K` to focus). Semantic + keyword hybrid over the whole library, ~50–150 ms. Results show book, author, chapter, page, excerpt with matched terms, and a relevance meter. Clicking a result opens the page in a side reader with the passage highlighted. |
| **Volume page** | Cover and details (editable title, author, description, tags), contents (from the PDF outline or detected headings), page browser, **Search within**, **Ask this volume**. |
| **Ask** | Questions across the library or within a book. The answer streams in with inline citations like `[Discourses of Epictetus, p. 186]`; hover to see the passage, click to open the page with it highlighted. Interpretation is set apart as *Synthesis*; follow-up questions keep the thread's context. |
| **Reader** | In-app PDF reader (pdf.js) with a contents rail, page navigation (← →), zoom, and a night mode. Cited passages are highlighted on the page. |

---

## How it works

```
PDF ─▶ text extraction ─▶ page-aware chunking ─▶ embeddings ─▶ Postgres (pgvector + full-text)
                                                                     │
question ─▶ hybrid retrieval ─▶ Claude reads passages, may search / read pages again (tools)
                                                                     │
                     answer citing passage IDs ─▶ citation + quotation verification ─▶ UI
```

**Extraction** (`src/lib/pdf/extract.ts`, pdf.js). Text is assembled into lines and paragraphs per physical page, using geometry (line gaps, indents) rather than trusting the PDF's text order blindly. Running headers, footers and bare page numbers are detected by repetition across pages and removed; words hyphenated across lines, and sentences running across page breaks, are rejoined. Printed page labels (roman-numbered front matter etc.) are kept for display. Chapters come from the PDF outline when it has one (resolved to the exact position on the page), refined with headings found in the text when an outline entry is very coarse, or detected from headings alone (font size, "CHAPTER IV"-style lines, run-in heads). Pages with no text layer are counted; a document that is mostly image-only is marked `needs_ocr`.

**Chunking** (`src/lib/ingest/chunk.ts`). Sentences are packed into ~250-word passages that prefer paragraph boundaries, never cross a chapter boundary, and overlap by a sentence or two. Each passage records the exact page range its text came from.

**Embeddings** (`src/lib/embed`). [BAAI bge-base-en-v1.5](https://huggingface.co/BAAI/bge-base-en-v1.5) (768-d) runs locally through ONNX Runtime (transformers.js), so book text never leaves the machine for indexing and re-indexing costs nothing. Each passage is embedded with a short header (author, title, chapter).

**Storage** (`db/migrations`). PostgreSQL holds documents, per-page text, passages with their `vector(768)` embeddings (HNSW index) and generated `tsvector` (GIN index), and a small job queue the worker claims with `FOR UPDATE SKIP LOCKED`. Original PDFs and covers live on disk under `data/storage` behind a small object-store interface (`src/lib/storage.ts`).

**Retrieval** (`src/lib/search/hybrid.ts`). Candidates come from both an approximate-nearest-neighbour vector search and a full-text search, then are ranked by cosine similarity plus a small boost for containing the query's *rare* terms. Postgres full-text ranking has no IDF, so words that occur in more than 4% of passages are ignored for matching, and quoted phrases are matched exactly. Neighbouring overlapping passages are collapsed, and library-wide results are gently diversified across books. Searches within a book use an exact scan (no ANN recall loss).

**Answering** (`src/lib/rag`). The question's passages are given to Claude with a server-issued ID each (`P1`, `P2`, …) bound to document, chapter and page range. Claude can call `search_library` (optionally restricted to specific books) and `read_pages` for more evidence, for a bounded number of rounds, and then answers citing IDs. The system prompt requires:

- claims about what a book says are cited; only IDs actually provided may be cited, and page numbers are never written by hand;
- quotations must be verbatim;
- interpretation, comparison and inference go in `<synthesis>` blocks, shown to you as *Synthesis · interpretation beyond the text*;
- if the passages are insufficient, say so rather than filling gaps;
- general knowledge only when you explicitly ask for it, marked *Outside the library*.

Then it is checked, not trusted: every citation is resolved against the passages that were retrieved (unknown IDs are flagged in red), and every quotation is matched against the retrieved text (unmatched quotes are listed as *Not found verbatim*). Because citations are IDs rather than free-text page numbers, the UI can only ever show a page that was actually retrieved.

The model defaults to `claude-opus-5-5` at `medium` effort (`LLM_MODEL`, `LLM_EFFORT`), streaming, with Anthropic's server-side refusal fallback (`fallbacks: "default"`) enabled.

---

## Quality checks

```bash
npm test                    # extraction, chunk page attribution, citation/quote verification, highlighting
npm run test:integration    # full answer loop against a local stand-in for the Messages API (needs the DB)
npm run eval:retrieval      # page accuracy of every indexed passage + retrieval quality
```

`eval:retrieval` measures two things against whatever is in your database:

1. **Page accuracy**: every passage's text is located in the page sequence and must start on the page it cites and end on the page it cites. On the development library (six PDFs, 1,613 pages, including an 836-page novel and a two-column paper) 99.6% of passages pass. The remainder are text-order quirks (footnotes, two-column layout) where the cited pages are still correct.
2. **Retrieval**: queries whose correct passage is identified by a verbatim phrase, most deliberately paraphrased so they share little wording with the text. On the development library:

   | ranking | hit@1 | hit@5 | MRR |
   |---|---|---|---|
   | vector only | 13/22 | 18/22 | 0.689 |
   | keyword only | 6/22 | 8/22 | 0.318 |
   | **hybrid (default)** | **13/22** | **19/22** | **0.712** |

   Plain reciprocal-rank fusion of the two lists scored *worse* than vector-only (MRR 0.48): without IDF, common words make the keyword list mostly noise. That result is why ranking is similarity-first with a small bounded boost for rare exact terms. You can pass your own cases: `npm run eval:retrieval -- my-cases.json` (an array of `{ "query", "book", "needles": [...] }`).

Handy CLIs: `npm run search -- "query"`, `npm run ask -- [--book <id>] "question"`, `npx tsx scripts/inspect-pdf.ts book.pdf [page]` (shows what extraction sees: outline, headers removed, chunk sizes).

---

## Project layout

```
src/
  app/                    Next.js pages and API routes
    page.tsx              library + search (home)
    search/ ask/          global search results, Ask the library
    books/[id]/           volume page, full reader
    api/                  documents (upload, metadata, file, cover, pages), search, ask (NDJSON stream), chunks
  components/             UI (library shelf, search, ask thread, reader, upload)
  lib/
    pdf/                  extraction, cover rendering
    ingest/               chunking, pipeline, job queue
    embed/                local embedding model
    search/               hybrid retrieval
    rag/                  answering loop, passage registry, citation/quote verification
    documents.ts db.ts storage.ts config.ts
scripts/                  worker, migrations, model download, CLI ingest/search/ask, evaluation
db/migrations/            SQL schema
tests/                    unit tests, answer-loop integration test, fixture PDF
```

## Configuration

Set in `.env` (see `.env.example`):

| variable | default | |
|---|---|---|
| `DATABASE_URL` | `postgres://jarvis:jarvis@localhost:5432/jarvis` | |
| `ANTHROPIC_API_KEY` | — | needed for answers only |
| `LLM_MODEL` | `claude-opus-5-5` | |
| `LLM_EFFORT` | `medium` | `low` … `max`; higher is slower and more thorough |
| `STORAGE_DIR` | `./data/storage` | original PDFs, covers |
| `MODELS_DIR` | `./models` | embedding model weights |
| `MAX_UPLOAD_MB` | `300` | |

## Extending it

The MVP is deliberately small, but the seams for the planned features are in place:

- **Notes, highlights, bookmarks, quotes, reading progress**: new tables referencing `documents.id` plus `pages.page` or `chunks.id`. The reader already maps a passage to text-layer spans on the page (`components/reader/highlight.ts`), which is the same mechanism highlights need.
- **Book and chapter summaries, concept extraction, connections between books**: new job kinds in the queue (`ingest/jobs.ts`), run by the worker after ingestion; chapters are already stored per passage and in `documents.outline`.
- **OCR for scanned books**: a job kind that runs OCR and feeds the result through the same pipeline; such documents are already marked `needs_ocr`.
- **Other embedding models or providers**: implement the `Embedder` interface (`lib/embed`); the vector dimension lives in the migration.
- **S3 or other object storage**: implement `ObjectStore` (`lib/storage.ts`).
- **Saved research threads**: the Ask API is stateless (history and prior passage references are sent by the client), so threads can be persisted without changing it.

## Known limitations

- Scanned (image-only) PDFs are detected but not OCR'd.
- Tuned for English: the full-text configuration and the embedding model are English-centric.
- No cross-encoder reranker yet; retrieval is embedding-first, and Claude's own follow-up searches make up much of the difference for hard questions.
- Title and author come from PDF metadata, a large title on the first pages, or a `Title by Author.pdf` filename. They are editable, and edits survive re-indexing, but re-index a volume after editing to refresh the embedding headers.
- Single user, no authentication; the servers listen on localhost only.
