/**
 * Ask a question from the command line and print the grounded answer with
 * resolved citations and quote verification.
 *
 *   npm run ask -- "What does Epictetus say is within our power?"
 *   npm run ask -- --book <document-id> "What are the central ideas of this book?"
 */
import "./env";
import { db } from "../src/lib/db";
import { ask } from "../src/lib/rag/ask";
import { pageRange, type Passage } from "../src/lib/rag/passages";

const args = process.argv.slice(2);
const documentIds: string[] = [];
while (args[0] === "--book") {
  args.shift();
  documentIds.push(args.shift()!);
}
const question = args.join(" ");
if (!question) {
  console.error('usage: npm run ask -- [--book <id>] "question"');
  process.exit(1);
}

let passages: Passage[] = [];
const t0 = Date.now();
for await (const e of ask({ question, documentIds })) {
  switch (e.type) {
    case "status":
      console.error(`… ${e.text}`);
      break;
    case "search":
      console.error(`⌕ "${e.query}"${e.books.length ? ` in ${e.books.join(", ")}` : ""} → ${e.found} passages`);
      break;
    case "read":
      console.error(`▤ reading ${e.book}, ${e.pages}`);
      break;
    case "passages":
      passages = e.passages;
      break;
    case "text":
      process.stdout.write(e.delta);
      break;
    case "done": {
      const byId = new Map(passages.map((p) => [p.id, p]));
      console.log(`\n\n── sources (${e.citations.cited.length} cited of ${passages.length} retrieved)`);
      for (const id of e.citations.cited) {
        const p = byId.get(id)!;
        console.log(`[${id}] ${p.title}${p.chapter ? ", " + p.chapter.split(" › ").pop() : ""}, ${pageRange(p)}`);
      }
      if (e.citations.unknown.length) console.log(`!! unknown citations: ${e.citations.unknown.join(", ")}`);
      for (const q of e.quotes) console.log(`${q.verified ? "✓" : "✗"} quote "${q.quote.slice(0, 80)}" ${q.foundIn.join(",")}`);
      console.log(`── ${e.usage.rounds} round(s), ${e.usage.inputTokens} in / ${e.usage.outputTokens} out tokens, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      break;
    }
    case "error":
      console.log(`\n[error] ${e.message}`);
      if (passages.length) {
        console.log(`\nRetrieved passages:`);
        for (const p of passages.slice(0, 6)) console.log(`[${p.id}] ${p.title}, ${pageRange(p)}: ${p.text.slice(0, 140).replace(/\s+/g, " ")}…`);
      }
      break;
  }
}
await db().end();
