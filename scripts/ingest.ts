/**
 * Add PDFs to the library from the command line and process them in this
 * process (no worker needed). Useful for bulk imports.
 *
 *   npm run ingest -- ~/Books/*.pdf
 */
import "./env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { createDocumentFromUpload, getDocument } from "../src/lib/documents";
import { ingestDocument } from "../src/lib/ingest/pipeline";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: npm run ingest -- <file.pdf> [...]");
  process.exit(1);
}

for (const file of files) {
  const t0 = Date.now();
  const { document, duplicate } = await createDocumentFromUpload(path.basename(file), new Uint8Array(await readFile(file)));
  if (duplicate) {
    console.log(`= ${path.basename(file)}: already in library as "${document.title}"`);
    continue;
  }
  // Process inline; mark the queued job done so a running worker skips it.
  await db().query(`update jobs set status = 'running', started_at = now() where document_id = $1 and status = 'pending'`, [document.id]);
  await ingestDocument(document.id, (m) => console.log(`  ${m}`));
  await db().query(`update jobs set status = 'done', finished_at = now() where document_id = $1 and status = 'running'`, [document.id]);
  const d = await getDocument(document.id);
  console.log(`+ ${d?.title} [${d?.status}] ${d?.pageCount} pages, ${d?.chunkCount} passages in ${((Date.now() - t0) / 1000).toFixed(1)}s${d?.statusDetail ? " — " + d.statusDetail : ""}`);
}
await db().end();
