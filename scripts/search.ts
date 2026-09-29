/**
 * Run a hybrid search from the command line.
 *
 *   npm run search -- "what is within our power"
 */
import "./env";
import { db } from "../src/lib/db";
import { hybridSearch } from "../src/lib/search/hybrid";

const query = process.argv.slice(2).join(" ");
if (!query) {
  console.error('usage: npm run search -- "your query"');
  process.exit(1);
}
const t0 = Date.now();
const hits = await hybridSearch(query, { limit: 8 });
console.log(`${hits.length} results in ${Date.now() - t0}ms\n`);
for (const h of hits) {
  const pages = h.pageStart === h.pageEnd ? `p.${h.pageStart}` : `pp.${h.pageStart}-${h.pageEnd}`;
  console.log(`${h.similarity.toFixed(3)}  v#${h.vectorRank ?? "-"} k#${h.keywordRank ?? "-"}  ${h.title} · ${pages}${h.chapter ? " · " + h.chapter.split(" › ").pop() : ""}`);
  console.log(`   ${h.headline.replace(/\u0001/g, "[").replace(/\u0002/g, "]").replace(/\s+/g, " ").slice(0, 260)}\n`);
}
await db().end();
