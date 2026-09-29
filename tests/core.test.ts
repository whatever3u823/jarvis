/**
 * Unit tests for the parts of the pipeline that decide what gets cited:
 * extraction (page attribution, header removal, chapters), chunking,
 * citation / quotation verification, answer parsing and reader highlighting.
 * No database or model needed.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { findHighlightRanges } from "../src/components/reader/highlight";
import { metadataFromFileName } from "../src/lib/documents";
import { chunkParagraphs } from "../src/lib/ingest/chunk";
import { extractPdf, openPdf, tidyTitle, type Paragraph } from "../src/lib/pdf/extract";
import { checkCitations, checkQuotes, extractCitations, normalizeForMatch } from "../src/lib/rag/verify";
import { keywordQuery } from "../src/lib/search/hybrid";
import { linkCitations, segmentAnswer } from "../src/lib/shared/answer";
import { chapterLeaf, pageRange, shortTitle } from "../src/lib/shared/format";

const FIXTURE = new URL("./fixtures/encheiridion-sample.pdf", import.meta.url);

test("extraction: pages, running headers, page numbers, chapters", async () => {
  const doc = await openPdf(new Uint8Array(await readFile(FIXTURE)));
  const ex = await extractPdf(doc);
  assert.equal(ex.pageCount, 9);
  assert.equal(ex.emptyPages.length, 0);
  assert.equal(ex.outlineSource, "pdf");
  // The single root entry (the book's own title) is dropped from chapter labels.
  assert.deepEqual(ex.outline.slice(1, 5).map((o) => o.title), ["I", "II", "III", "IV"]);

  // The running header and footer page numbers are gone from the body text.
  for (const p of ex.pages.slice(1)) {
    assert.ok(!p.text.includes("The Encheiridion, or Manual"), `header left on page ${p.page}`);
    assert.ok(!/(^|\n)\d{1,2}(\n|$)/.test(p.text), `page number left on page ${p.page}`);
  }
  // Known text lands on the right page.
  assert.ok(ex.pages[0].text.includes("Of things some are in our power"));
  const p3 = ex.pages[2].text;
  assert.ok(p3.includes("Remember that desire contains in it the profession"));

  // Paragraphs carry the chapter they belong to.
  const para = ex.paragraphs.find((p) => p.text.startsWith("Remember that desire"))!;
  assert.equal(para.chapter, "II");
});

test("chunking: every chunk's text occurs on exactly the pages it cites", async () => {
  const doc = await openPdf(new Uint8Array(await readFile(FIXTURE)));
  const ex = await extractPdf(doc);
  const chunks = chunkParagraphs(ex.paragraphs);
  assert.ok(chunks.length >= 5);
  const norm = ex.pages.map((p) => normalizeForMatch(p.text));
  for (const c of chunks) {
    const span = norm.slice(c.pageStart - 1, c.pageEnd).join(" ");
    const text = normalizeForMatch(c.text);
    assert.ok(span.includes(text), `chunk ${c.ordinal} (pp.${c.pageStart}-${c.pageEnd}) not found on its pages`);
    const words = text.split(" ");
    assert.ok(norm[c.pageStart - 1].includes(words.slice(0, 3).join(" ")), `chunk ${c.ordinal} does not start on p.${c.pageStart}`);
    assert.ok(norm[c.pageEnd - 1].includes(words.slice(-2).join(" ")), `chunk ${c.ordinal} does not end on p.${c.pageEnd}`);
  }
  // A sentence running across a page break is not split by a paragraph break.
  assert.ok(chunks.some((c) => c.text.includes("attempt to avoid only the things contrary to nature")));
});

function para(text: string, page: number, chapter: string | null, heading = false): Paragraph {
  return { text, page, y: 0, heading, chapter };
}

test("chunking: respects chapter boundaries and size limits", () => {
  const sentence = (n: number) => `Sentence number ${n} says something about virtue and the will of man.`;
  const paras: Paragraph[] = [];
  for (let i = 0; i < 60; i++) paras.push(para(`${sentence(i)} ${sentence(i + 100)}`, 1 + Math.floor(i / 6), i < 30 ? "Book I" : "Book II"));
  const chunks = chunkParagraphs(paras);
  for (const c of chunks) {
    assert.ok(c.wordCount <= 380, `chunk too large: ${c.wordCount}`);
    assert.ok(c.pageStart <= c.pageEnd);
  }
  // No chunk mixes chapters.
  const bookII = chunks.filter((c) => c.text.includes("Sentence number 30 "));
  assert.ok(bookII.every((c) => c.chapter === "Book II"));
  assert.ok(chunks.filter((c) => c.chapter === "Book I").every((c) => !/Sentence number (3\d|4\d|5\d) /.test(c.text)));
});

test("citations: known and unknown passage IDs", () => {
  assert.deepEqual(extractCitations("A [P1]. B [P2, P3]; C [P4][P5]."), ["P1", "P2", "P3", "P4", "P5"]);
  const check = checkCitations("As he says [P1][P7].", new Set(["P1", "P2"]));
  assert.deepEqual(check, { cited: ["P1"], unknown: ["P7"] });
});

test("quotations: verbatim quotes verify, invented ones don't", () => {
  const passages = [
    { id: "P1", text: "Men are disturbed not by the things which hap-\npen, but by the opinions about the things." },
    { id: "P2", text: "Of things some are in our power, and others are not." },
  ];
  const answer =
    `He writes that “men are disturbed not by the things which happen” [P1], ` +
    `that "Of things some are in our power ... and others are not" [P2], ` +
    `and that “virtue is a golden lamp that never goes out” [P2].`;
  const q = checkQuotes(answer, passages);
  assert.equal(q.length, 3);
  assert.deepEqual(q.map((x) => x.verified), [true, true, false]);
  assert.deepEqual(q[0].foundIn, ["P1"]);
});

test("answer parsing: synthesis / outside blocks and streaming partial tags", () => {
  const segs = segmentAnswer("Direct [P1].\n\n<synthesis>Inference [P2].</synthesis>\n\n<outside>General.</outside>");
  assert.deepEqual(segs.map((s) => s.kind), ["text", "synthesis", "outside"]);
  // A tag still streaming in is hidden, an unclosed block is treated as open.
  assert.deepEqual(segmentAnswer("Text <synth").map((s) => s.body.trim()), ["Text"]);
  assert.equal(segmentAnswer("A <synthesis>partial")[1].kind, "synthesis");
  assert.equal(linkCitations("x [P1, P2]"), "x [P1](cite:P1)[P2](cite:P2)");
});

test("reader highlight: finds a passage across spans, spacing and hyphenation", () => {
  const spans = ["Chapter I", "Of things some are in our pow-", "er, and others", " are not.", "In our power are opinion,", "movement towards a thing."];
  assert.deepEqual(findHighlightRanges(spans, "Of things some are in our power, and others are not."), [1, 2, 3]);
  // A chunk that starts on the previous page: only its tail is on this page.
  const tail = findHighlightRanges(spans, "Something from the previous page that is long enough. Of things some are in our power, and others are not. In our power are opinion");
  assert.ok(tail.includes(1) && tail.includes(4) && !tail.includes(0));
  assert.deepEqual(findHighlightRanges(spans, "entirely unrelated words that do not appear"), []);
});

test("keyword query drops request words but keeps the subject", () => {
  assert.equal(keywordQuery("What do these books say about suffering?")?.text, "suffering");
  assert.equal(keywordQuery('find "within our power"')?.mode, "web");
  assert.equal(keywordQuery("what do these books say"), null);
});

test("metadata and formatting helpers", () => {
  assert.deepEqual(metadataFromFileName("Meditations by Marcus Aurelius.pdf"), { title: "Meditations", author: "Marcus Aurelius" });
  assert.deepEqual(metadataFromFileName("the-brothers-karamazov.pdf"), { title: "The brothers karamazov", author: null });
  assert.equal(tidyTitle("THE ENCHEIRIDION, OR MANUAL."), "The Encheiridion, or Manual");
  assert.equal(tidyTitle("XIV."), "XIV");
  assert.equal(pageRange({ pageStart: 42, pageEnd: 42 }), "p. 42");
  assert.equal(pageRange({ pageStart: 42, pageEnd: 43, pageLabelStart: "xl", pageLabelEnd: "xli" }), "pp. xl–xli");
  assert.equal(chapterLeaf("The Encheiridion, or Manual › VIII"), "The Encheiridion, or Manual · VIII");
  assert.equal(chapterLeaf("Part I › How We Should Behave to Tyrants"), "How We Should Behave to Tyrants");
  assert.equal(shortTitle("A Selection from the Discourses of Epictetus"), "Discourses of Epictetus");
});
