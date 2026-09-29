/**
 * Print what the extraction pipeline sees in a PDF, without touching the
 * database: metadata, outline, empty pages, and sample paragraphs.
 *
 *   npx tsx scripts/inspect-pdf.ts path/to/book.pdf [page]
 */
import { readFile } from "node:fs/promises";
import { extractPdf, openPdf } from "../src/lib/pdf/extract";
import { chunkParagraphs } from "../src/lib/ingest/chunk";

const [file, pageArg] = process.argv.slice(2);
if (!file) {
  console.error("usage: tsx scripts/inspect-pdf.ts <file.pdf> [page]");
  process.exit(1);
}

const t0 = Date.now();
const doc = await openPdf(new Uint8Array(await readFile(file)));
const ex = await extractPdf(doc);
console.log(`pages: ${ex.pageCount}  extracted in ${Date.now() - t0}ms`);
console.log("info:", ex.info);
console.log("typographic title:", ex.typographicTitle);
console.log(`empty pages: ${ex.emptyPages.length}`, ex.emptyPages.slice(0, 20));
console.log(`outline (${ex.outlineSource}): ${ex.outline.length} entries`);
for (const o of ex.outline.slice(0, 25)) console.log(`  p.${o.page}  ${"  ".repeat(o.level)}${o.title}`);

const chunks = chunkParagraphs(ex.paragraphs);
const words = chunks.map((c) => c.wordCount);
console.log(`chunks: ${chunks.length}  words min/avg/max: ${Math.min(...words)}/${Math.round(words.reduce((a, b) => a + b, 0) / words.length)}/${Math.max(...words)}`);

const page = Number(pageArg || Math.min(12, ex.pageCount));
console.log(`\n--- page ${page} (label ${ex.pages[page - 1]?.label ?? "-"}) ---`);
for (const p of ex.paragraphs.filter((p) => p.page === page))
  console.log(`[${p.heading ? "H" : "P"}${p.chapter ? " · " + p.chapter : ""}] ${p.text}\n`);

const sample = chunks.find((c) => c.pageStart >= page) ?? chunks[0];
console.log(`--- first chunk at/after page ${page}: pp.${sample.pageStart}-${sample.pageEnd} · ${sample.chapter} ---\n${sample.text}`);
