/**
 * Retrieval and citation-accuracy checks against the documents in the
 * database.
 *
 * 1. Page accuracy: every chunk's text must actually occur on the pages it
 *    claims (page_start..page_end), starting on page_start and ending on
 *    page_end. This is what makes page citations trustworthy.
 * 2. Retrieval quality: paraphrased queries (sharing little wording with the
 *    text) whose correct passage is identified by a verbatim "needle".
 *    Reports hit@1 / hit@5 / MRR for vector-only, keyword-only and hybrid.
 *
 *   npm run eval:retrieval            (cases for the bundled sample library)
 *   npm run eval:retrieval -- cases.json
 */
import "./env";
import { readFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { hybridSearch } from "../src/lib/search/hybrid";
import { normalizeForMatch } from "../src/lib/rag/verify";

interface Case {
  query: string;
  /** Substring of the expected book's title. */
  book: string;
  /** All of these must appear in a relevant passage. */
  needles: string[];
}

const DEFAULT_CASES: Case[] = [
  { query: "the distinction between what is up to us and what is not", book: "Epictetus", needles: ["Of things some are in our power"] },
  { query: "people are upset not by events themselves but by their judgments about them", book: "Epictetus", needles: ["not by the things"] },
  { query: "what to do when you hear that someone has been criticising you behind your back", book: "Epictetus", needles: ["speaks ill of you"] },
  { query: "responding to a ruler who threatens to imprison and kill you", book: "Epictetus", needles: ["But the tyrant will chain"] },
  { query: "after a theft he consoles himself that he only lost a cheap object", book: "Epictetus", needles: ["earthen lamp"] },
  { query: "a man may prefer pain to happiness and be in love with it", book: "Underground", needles: ["passionately, in love with suffering"] },
  { query: "the narrator introduces himself as ill and malicious", book: "Underground", needles: ["I am a sick man"] },
  { query: "the nightmare in which drunk peasants flog an old horse to death", book: "Crime", needles: ["Mikolka", "mare"] },
  { query: "she reads him the gospel story of a man raised from the dead", book: "Crime", needles: ["Lazarus"] },
  { query: "each morning expect to meet ungrateful, meddling and arrogant people", book: "Meditations", needles: ["morning", "unthankful"] },
  { query: "the emperor lists the virtues he learned from his relatives and teachers", book: "Meditations", needles: ["grandfather Verus"] },
  { query: "how the compiler handles loops inside loops when recording traces", book: "Trace", needles: ["nested trace tree"] },
  // Queries that share distinctive words or names with the text.
  { query: "What does Epictetus say about the things within our power?", book: "Epictetus", needles: ["Of things some are in our power"] },
  { query: "Mikolka and the mare", book: "Crime", needles: ["Mikolka", "mare"] },
  { query: "Sonia reading the raising of Lazarus", book: "Crime", needles: ["Lazarus", "Sonia"] },
  { query: "the earthen lamp", book: "Epictetus", needles: ["earthen lamp"] },
  { query: "what he learned from his grandfather Verus", book: "Meditations", needles: ["grandfather Verus"] },
  { query: "spite and the spiteful official", book: "Underground", needles: ["spiteful"] },
  // Rare exact terms, where keyword matching should help.
  { query: "hupolaepsis", book: "Epictetus", needles: ["hupolaepsis"] },
  { query: "the story about Felicion", book: "Epictetus", needles: ["Felicion"] },
  { query: "Epaphroditus", book: "Epictetus", needles: ["Epaphroditus"] },
  { query: "what did Rusticus teach him", book: "Meditations", needles: ["Rusticus"] },
];

async function pageAccuracy() {
  const { rows: chunks } = await db().query(
    `select c.id, c.document_id, c.page_start, c.page_end, c.text, d.title from chunks c join documents d on d.id = c.document_id`,
  );
  const { rows: pages } = await db().query(`select document_id, page, text from pages`);
  const pageText = new Map(pages.map((p) => [`${p.document_id}:${p.page}`, normalizeForMatch(p.text)]));
  let ok = 0;
  const bad: string[] = [];
  for (const c of chunks) {
    // Concatenate the cited pages (plus one either side) and locate the chunk
    // exactly; it must begin on page_start and end on page_end.
    const pagesIn: { page: number; start: number; end: number }[] = [];
    let joined = "";
    for (let p = c.page_start - 1; p <= c.page_end + 1; p++) {
      const t = pageText.get(`${c.document_id}:${p}`);
      if (!t) continue;
      if (joined) joined += " ";
      pagesIn.push({ page: p, start: joined.length, end: joined.length + t.length });
      joined += t;
    }
    const whole = normalizeForMatch(c.text);
    const at = joined.indexOf(whole);
    const pageAt = (i: number) => pagesIn.find((x) => i >= x.start && i < x.end)?.page;
    const fine = at >= 0 && pageAt(at) === c.page_start && pageAt(at + whole.length - 1) === c.page_end;
    if (fine) ok++;
    else if (bad.length < 5)
      bad.push(`${c.title} chunk ${c.id} pp.${c.page_start}-${c.page_end}: ${at < 0 ? "text not found" : `found on pp.${pageAt(at)}-${pageAt(at + whole.length - 1)}`}`);
  }
  console.log(`\nPage accuracy: ${ok}/${chunks.length} chunks found verbatim on exactly the pages they cite (${((ok / chunks.length) * 100).toFixed(2)}%)`);
  for (const b of bad) console.log(`  ✗ ${b}`);
}

async function retrieval(cases: Case[]) {
  const variants: { name: string; mode: "vector" | "keyword" | "hybrid"; keywordBoost?: number }[] = [
    { name: "vector", mode: "vector" },
    { name: "keyword", mode: "keyword" },
    { name: "hybrid(.03)", mode: "hybrid", keywordBoost: 0.03 },
    { name: "hybrid", mode: "hybrid" },
    { name: "hybrid(.06)", mode: "hybrid", keywordBoost: 0.06 },
  ];
  console.log(`\nRetrieval: ${cases.length} queries, library-wide (the default is the plain "hybrid" row)`);
  for (const { name, mode, keywordBoost } of variants) {
    let h1 = 0, h5 = 0, rr = 0;
    const misses: string[] = [];
    for (const c of cases) {
      const hits = await hybridSearch(c.query, { limit: 10, mode, keywordBoost });
      const needles = c.needles.map(normalizeForMatch);
      const rank = hits.findIndex((h) => h.title.includes(c.book) && needles.every((n) => normalizeForMatch(h.text).includes(n)));
      if (rank === 0) h1++;
      if (rank >= 0 && rank < 5) h5++;
      if (rank >= 0) rr += 1 / (rank + 1);
      if (name === "hybrid" && (rank < 0 || rank >= 5)) misses.push(`  rank ${rank < 0 ? ">10" : rank + 1}: ${c.query}`);
    }
    console.log(
      `  ${name.padEnd(12)} hit@1 ${h1}/${cases.length}  hit@5 ${h5}/${cases.length}  MRR ${(rr / cases.length).toFixed(3)}`,
    );
    if (misses.length) console.log(misses.join("\n"));
  }
}

const file = process.argv[2];
const cases: Case[] = file ? JSON.parse(await readFile(file, "utf8")) : DEFAULT_CASES;
await pageAccuracy();
await retrieval(cases);
await db().end();
