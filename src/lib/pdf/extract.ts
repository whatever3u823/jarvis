import path from "node:path";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

/**
 * PDF text extraction that preserves what matters for citation:
 * page numbers (physical and printed labels), paragraph structure, and
 * chapter boundaries (from the PDF outline or, failing that, from headings
 * detected by font size).
 *
 * Running headers/footers and bare page numbers are removed so they do not
 * pollute chunks, and words hyphenated across line breaks are rejoined.
 */

export interface Paragraph {
  text: string;
  /** 1-based physical page number. */
  page: number;
  /** Baseline y of the first line (PDF units, origin bottom-left). */
  y: number;
  heading: boolean;
  /** Chapter label ("Book I › Chapter 3"), filled in by assignChapters. */
  chapter: string | null;
  /**
   * The paragraph continues the previous page's last paragraph (a sentence
   * running across the page break). "nospace" when a word was hyphenated
   * across the break.
   */
  continues?: "space" | "nospace";
}

export interface ExtractedPage {
  page: number;
  label: string | null;
  /** Cleaned page text, paragraphs separated by blank lines. */
  text: string;
  charCount: number;
}

export interface OutlineEntry {
  title: string;
  page: number;
  level: number;
}

export interface PdfInfo {
  title: string | null;
  author: string | null;
  subject: string | null;
  keywords: string | null;
  creator: string | null;
  producer: string | null;
  creationDate: string | null;
}

export interface Extraction {
  pageCount: number;
  pages: ExtractedPage[];
  paragraphs: Paragraph[];
  outline: OutlineEntry[];
  outlineSource: "pdf" | "headings" | "none";
  info: PdfInfo;
  /** Best guess at the title from the largest text on the first pages. */
  typographicTitle: string | null;
  /** Pages with no meaningful text layer. */
  emptyPages: number[];
}

interface Line {
  text: string;
  x: number;
  xEnd: number;
  y: number;
  size: number;
}

const PDFJS_DIR = path.join(process.cwd(), "node_modules", "pdfjs-dist");

export async function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
    standardFontDataUrl: path.join(PDFJS_DIR, "standard_fonts") + path.sep,
    cMapUrl: path.join(PDFJS_DIR, "cmaps") + path.sep,
    cMapPacked: true,
  }).promise;
}

const EMPTY_PAGE_CHARS = 25;

export async function extractPdf(
  doc: PDFDocumentProxy,
  onProgress?: (done: number, total: number) => void,
): Promise<Extraction> {
  const pageCount = doc.numPages;
  const labels = await doc.getPageLabels().catch(() => null);

  // 1. Lines per page, in content-stream order (which preserves column order).
  const pageLines: Line[][] = [];
  for (let p = 1; p <= pageCount; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pageLines.push(buildLines(content.items as unknown[]));
    page.cleanup();
    if (onProgress && (p % 10 === 0 || p === pageCount)) onProgress(p, pageCount);
  }

  const bodySize = dominantFontSize(pageLines);
  removeRunningHeadersAndFooters(pageLines, bodySize);

  // 2. Paragraphs.
  const paragraphs: Paragraph[] = [];
  const pages: ExtractedPage[] = [];
  const emptyPages: number[] = [];
  pageLines.forEach((lines, i) => {
    const page = i + 1;
    const paras = buildParagraphs(lines, page, bodySize);
    paragraphs.push(...paras);
    const text = paras.map((p) => p.text).join("\n\n");
    const charCount = text.replace(/\s+/g, "").length;
    if (charCount < EMPTY_PAGE_CHARS) emptyPages.push(page);
    pages.push({ page, label: labels?.[i] || null, text, charCount });
  });

  markPageContinuations(paragraphs);

  // 3. Chapters: prefer the PDF's own outline, fall back to detected headings.
  let outlineSource: Extraction["outlineSource"] = "none";
  let markers = await outlineMarkers(doc);
  const headings = headingMarkers(paragraphs, bodySize);
  if (markers.length >= 2) {
    outlineSource = "pdf";
    markers = refineCoarseOutline(markers, headings, pageCount);
  } else {
    markers = headings;
    outlineSource = markers.length >= 2 ? "headings" : "none";
    if (outlineSource === "none") markers = [];
  }
  assignChapters(paragraphs, markers);

  const meta = await doc.getMetadata().catch(() => null);
  const infoDict = (meta?.info ?? {}) as Record<string, unknown>;
  const str = (k: string) => {
    const v = infoDict[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  return {
    pageCount,
    pages,
    paragraphs,
    outline: markers.map((m) => ({ title: m.label, page: m.page, level: m.level })),
    outlineSource,
    info: {
      title: str("Title"),
      author: str("Author"),
      subject: str("Subject"),
      keywords: str("Keywords"),
      creator: str("Creator"),
      producer: str("Producer"),
      creationDate: str("CreationDate"),
    },
    typographicTitle: typographicTitle(paragraphs, pageLines, bodySize),
    emptyPages,
  };
}

// ---------------------------------------------------------------------------
// Lines

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL: boolean;
}

function buildLines(items: unknown[]): Line[] {
  const lines: Line[] = [];
  let cur: Line | null = null;
  const flush = () => {
    if (cur && cur.text.trim()) {
      cur.text = cur.text.replace(/\s+/g, " ").trim();
      lines.push(cur);
    }
    cur = null;
  };

  for (const raw of items) {
    if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
    const item = raw as TextItemLike;
    const t = item.transform;
    const size = Math.hypot(t[2], t[3]) || item.height || 10;
    const x = t[4];
    const y = t[5];

    if (item.str !== "") {
      const c = cur as Line | null;
      const sameLine =
        c !== null &&
        Math.abs(y - c.y) <= Math.max(c.size, size) * 0.5 &&
        x >= c.xEnd - Math.max(c.size, size) * 1.5;
      if (c && sameLine) {
        const gap = x - c.xEnd;
        if (gap > size * 0.15 && !c.text.endsWith(" ") && !item.str.startsWith(" ")) c.text += " ";
        c.text += item.str;
        c.xEnd = Math.max(c.xEnd, x + item.width);
        // Keep the line's size as that of its dominant (first, full-size) text;
        // superscripts and drop caps should not redefine it.
        if (c.text.trim().length < 3) c.size = Math.max(c.size, size);
      } else {
        flush();
        cur = { text: item.str, x, xEnd: x + item.width, y, size };
      }
    }
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

function dominantFontSize(pageLines: Line[][]): number {
  const weights = new Map<number, number>();
  for (const lines of pageLines)
    for (const l of lines) {
      const k = Math.round(l.size * 2) / 2;
      weights.set(k, (weights.get(k) ?? 0) + l.text.length);
    }
  let best = 10;
  let bestW = -1;
  for (const [k, w] of weights) if (w > bestW) [best, bestW] = [k, w];
  return best;
}

const PAGE_NUMBER_RE = /^[\s\-–—|.·•]*(?:page\s*)?(?:\d{1,4}|[ivxlcdm]{1,7})[\s\-–—|.·•]*$/i;

function normalizeForRepeat(text: string): string {
  return text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

/**
 * Running headers/footers are short lines at the very top or bottom of the
 * page whose (digit-normalised) text repeats across many pages.
 */
function removeRunningHeadersAndFooters(pageLines: Line[][], bodySize: number) {
  const n = pageLines.length;
  const extremes = (lines: Line[]) => {
    if (lines.length === 0) return [];
    const byY = [...lines].sort((a, b) => b.y - a.y);
    const picks = new Set<Line>([byY[0], byY[1], byY[byY.length - 1], byY[byY.length - 2]].filter(Boolean));
    return [...picks];
  };

  const counts = new Map<string, number>();
  for (const lines of pageLines) {
    const seen = new Set<string>();
    for (const l of extremes(lines)) seen.add(normalizeForRepeat(l.text));
    for (const k of seen) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.ceil(n * 0.04));

  pageLines.forEach((lines, i) => {
    const drop = new Set<Line>();
    for (const l of extremes(lines)) {
      if (l.size >= bodySize * 1.2) continue; // a real heading, not a running head
      const key = normalizeForRepeat(l.text);
      if (PAGE_NUMBER_RE.test(l.text)) drop.add(l);
      else if (l.text.length <= 120 && (counts.get(key) ?? 0) >= threshold) drop.add(l);
    }
    if (drop.size) pageLines[i] = lines.filter((l) => !drop.has(l));
  });
}

// ---------------------------------------------------------------------------
// Paragraphs

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function isHeadingLine(l: Line, bodySize: number): boolean {
  return l.size >= bodySize * 1.2 && l.text.length <= 160 && /\p{L}/u.test(l.text);
}

function joinLine(prev: string, next: string): string {
  // Rejoin words hyphenated across a line break: "philoso-" + "phy".
  const m = prev.match(/(\p{L})[-­]$/u);
  if (m && /^\p{Ll}/u.test(next)) return prev.slice(0, -1) + next;
  if (prev.endsWith("­")) return prev.slice(0, -1) + next;
  return prev + " " + next;
}

function buildParagraphs(lines: Line[], page: number, bodySize: number): Paragraph[] {
  if (lines.length === 0) return [];
  const bodyLines = lines.filter((l) => !isHeadingLine(l, bodySize));
  const left = median(bodyLines.map((l) => l.x)) || lines[0].x;
  const right = Math.max(...bodyLines.map((l) => l.xEnd), 0);
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y;
    if (g > 0 && g < lines[i].size * 3) gaps.push(g);
  }
  const lineGap = median(gaps) || bodySize * 1.3;

  const paras: Paragraph[] = [];
  let cur: Paragraph | null = null;
  let prev: Line | null = null;

  for (const l of lines) {
    const heading = isHeadingLine(l, bodySize);
    let startNew = cur === null;
    if (!startNew && prev) {
      const gap = prev.y - l.y;
      const indented = l.x > left + l.size * 0.8 && l.x < left + l.size * 8;
      const prevShort =
        right > 0 && prev.xEnd < right - l.size * 2.5 && /[.!?:;"'”’)\]]$/.test(prev.text);
      startNew =
        heading !== cur!.heading ||
        gap < -l.size || // moved up the page: new column or block
        gap > lineGap * 1.45 ||
        (indented && !heading) ||
        prevShort;
      // A line starting in lower case after an unfinished sentence continues
      // the paragraph, whatever the layout suggests.
      if (
        startNew &&
        !heading &&
        !cur!.heading &&
        gap >= -l.size &&
        gap < lineGap * 2.5 &&
        /^\p{Ll}/u.test(l.text) &&
        !/[.!?:;"'”’)\]]$/.test(prev.text)
      ) {
        startNew = false;
      }
    }
    if (startNew) {
      if (cur) paras.push(cur);
      cur = { text: l.text, page, y: l.y, heading, chapter: null };
    } else {
      cur!.text = joinLine(cur!.text, l.text);
    }
    prev = l;
  }
  if (cur) paras.push(cur);
  return paras
    .map((p) => ({ ...p, text: p.text.replace(/\s+/g, " ").trim() }))
    .filter((p) => p.text.length > 0);
}

/** Link a page's first paragraph to the previous page's last one when a sentence runs across the break. */
function markPageContinuations(paragraphs: Paragraph[]) {
  for (let i = 1; i < paragraphs.length; i++) {
    const prev = paragraphs[i - 1];
    const cur = paragraphs[i];
    if (cur.page === prev.page || cur.heading || prev.heading) continue;
    const endsOpen = !/[.!?:;"'”’)\]…]$/.test(prev.text);
    const startsLower = /^[\p{Ll},;)\]’”]/u.test(cur.text);
    if (/\p{L}[-\u00AD]$/u.test(prev.text) && /^\p{Ll}/u.test(cur.text)) {
      prev.text = prev.text.slice(0, -1);
      cur.continues = "nospace";
    } else if (endsOpen && (startsLower || !/[.!?]/.test(prev.text.slice(-40)))) {
      cur.continues = "space";
    }
  }
}

// ---------------------------------------------------------------------------
// Chapters

interface Marker {
  page: number;
  /** Top of the destination in PDF units; Infinity means top of page. */
  y: number;
  level: number;
  /** Display label, e.g. "The Encheiridion › VIII". */
  label: string;
}

/** "THE ENCHEIRIDION, OR MANUAL." -> "The Encheiridion, or Manual" */
export function tidyTitle(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim().replace(/[.:]+$/, "");
  const letters = t.replace(/[^\p{L}]/gu, "");
  const isRoman = /^[IVXLCDM]+$/.test(letters);
  if (letters.length > 3 && letters === letters.toUpperCase() && !isRoman) {
    const small = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
    t = t
      .toLowerCase()
      .split(" ")
      .map((w, i) => {
        if (/^[ivxlcdm]+[.,]?$/.test(w)) return w.toUpperCase();
        if (i > 0 && small.has(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(" ");
  }
  return t;
}

async function outlineMarkers(doc: PDFDocumentProxy): Promise<Marker[]> {
  const outline = await doc.getOutline().catch(() => null);
  if (!outline || outline.length === 0) return [];

  interface Flat {
    path: string[];
    page: number;
    y: number;
    level: number;
  }
  const flat: Flat[] = [];

  async function resolve(dest: unknown): Promise<{ page: number; y: number } | null> {
    try {
      const explicit = typeof dest === "string" ? await doc.getDestination(dest) : dest;
      if (!Array.isArray(explicit) || explicit.length === 0) return null;
      const ref = explicit[0];
      const pageIndex =
        typeof ref === "number" ? ref : await doc.getPageIndex(ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0]);
      const kind = (explicit[1] as { name?: string } | undefined)?.name;
      let y = Infinity;
      if (kind === "XYZ" && typeof explicit[3] === "number") y = explicit[3];
      else if ((kind === "FitH" || kind === "FitBH") && typeof explicit[2] === "number") y = explicit[2];
      return { page: pageIndex + 1, y };
    } catch {
      return null;
    }
  }

  type Node = { title: string; dest: unknown; items: Node[] };
  async function walk(nodes: Node[], parents: string[], level: number) {
    for (const node of nodes) {
      const title = tidyTitle(node.title || "");
      const loc = await resolve(node.dest);
      const pathTitles = title ? [...parents, title] : parents;
      if (loc && title) flat.push({ path: pathTitles, page: loc.page, y: loc.y, level });
      if (node.items?.length) await walk(node.items, pathTitles, level + 1);
    }
  }
  await walk(outline as Node[], [], 0);

  // A single root entry is usually the book's own title; omit it from labels.
  const dropRoot = outline.length === 1 && flat.length > 1;
  return flat
    .map((f) => {
      const p = dropRoot ? f.path.slice(1) : f.path;
      const label = (p.length ? p : f.path).slice(-2).join(" › ");
      return { page: f.page, y: f.y, level: dropRoot ? Math.max(0, f.level - 1) : f.level, label };
    })
    .sort((a, b) => a.page - b.page || b.y - a.y);
}

/** Run-in heads: "OF THE THINGS WHICH ARE IN OUR POWER.—Of all the faculties…" */
const RUN_IN_HEAD_RE = /^((?:[A-Z][A-Z'’,;\-]*\s+){2,}[A-Z][A-Z'’,;\-]*)[.:]?\s*[—–]\s*\S/;

function shorten(label: string, max = 90): string {
  if (label.length <= max) return label;
  const cut = label.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

const HEADING_WORD_RE = /^(chapter|book|part|section|letter|canto|act|scene|lecture|essay)\s+([ivxlcdm]+|\d+|[a-z]+)\b/i;
/** Short all-caps lines naming a structural unit: "THE SECOND BOOK", "PREFACE". */
const CAPS_HEADING_RE =
  /^(?:[\p{Lu}\d.'’]+\s+){0,3}(?:BOOK|CHAPTER|PART|SECTION|INTRODUCTION|PREFACE|PROLOGUE|EPILOGUE|APPENDIX|CONCLUSION|AFTERWORD|FOREWORD|LETTER|LECTURE)(?:\s+[\p{Lu}\d.'’]+){0,3}$/u;

function headingMarkers(paragraphs: Paragraph[], bodySize: number): Marker[] {
  const markers: Marker[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const byPattern =
      !p.heading && p.text.length <= 80 && (HEADING_WORD_RE.test(p.text) || CAPS_HEADING_RE.test(p.text));
    const runIn = !p.heading && !byPattern ? p.text.match(RUN_IN_HEAD_RE) : null;
    if (runIn) {
      markers.push({ page: p.page, y: p.y + bodySize * 2, level: 1, label: shorten(tidyTitle(runIn[1])) });
      continue;
    }
    if (!p.heading && !byPattern) continue;
    // Merge a run of consecutive heading paragraphs on the same page
    // ("CHAPTER I" + "Of the things which are in our power").
    let label = p.text;
    let j = i + 1;
    while (j < paragraphs.length && paragraphs[j].heading && paragraphs[j].page === p.page && j - i < 3) {
      label += " — " + paragraphs[j].text;
      j++;
    }
    i = j - 1;
    if (label.length > 160) continue;
    markers.push({ page: p.page, y: p.y + bodySize * 2, level: 0, label: tidyTitle(label) });
  }
  // A page with many "headings" is a table of contents, not chapter starts.
  const perPage = new Map<number, number>();
  for (const m of markers) perPage.set(m.page, (perPage.get(m.page) ?? 0) + 1);
  return markers.filter((m) => (perPage.get(m.page) ?? 0) <= 4);
}

/**
 * A PDF outline is sometimes coarse (one entry for a 180-page section). Where
 * a leaf entry spans many pages, use headings detected in the text inside
 * that span as finer-grained sub-chapters.
 */
function refineCoarseOutline(outline: Marker[], headings: Marker[], pageCount: number): Marker[] {
  const before = (a: { page: number; y: number }, b: { page: number; y: number }) =>
    a.page < b.page || (a.page === b.page && a.y > b.y);
  const out: Marker[] = [];
  outline.forEach((m, i) => {
    out.push(m);
    const next = outline[i + 1];
    const endPage = next ? next.page : pageCount + 1;
    if (endPage - m.page < 15) return;
    const inner = headings.filter((h) => before(m, h) && (!next || before(h, next)));
    if (inner.length < 2) return;
    const parent = m.label.split(" › ").pop()!;
    for (const h of inner) out.push({ page: h.page, y: h.y, level: m.level + 1, label: `${parent} › ${h.label}` });
  });
  return out;
}

function assignChapters(paragraphs: Paragraph[], markers: Marker[]) {
  if (markers.length === 0) return;
  let mi = -1;
  for (const p of paragraphs) {
    // Advance while the next marker starts at or before this paragraph.
    while (
      mi + 1 < markers.length &&
      (markers[mi + 1].page < p.page || (markers[mi + 1].page === p.page && markers[mi + 1].y + 2 >= p.y))
    ) {
      mi++;
    }
    p.chapter = mi >= 0 ? markers[mi].label : null;
  }
}

// ---------------------------------------------------------------------------
// Title guess

function typographicTitle(paragraphs: Paragraph[], pageLines: Line[][], bodySize: number): string | null {
  let best: Line | null = null;
  for (const lines of pageLines.slice(0, 3))
    for (const l of lines) {
      if (!/\p{L}{3}/u.test(l.text) || l.text.length > 120) continue;
      if (!best || l.size > best.size) best = l;
    }
  if (!best || best.size < bodySize * 1.3) return null;
  // Title lines are often split; include immediate neighbours of equal size.
  const page = pageLines.slice(0, 3).find((ls) => ls.includes(best!))!;
  const idx = page.indexOf(best);
  const parts = [best.text];
  for (let k = idx + 1; k < page.length && Math.abs(page[k].size - best.size) < 0.5 && parts.length < 4; k++)
    parts.push(page[k].text);
  void paragraphs;
  return tidyTitle(parts.join(" "));
}
