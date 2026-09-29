import type { Paragraph } from "../pdf/extract";

/**
 * Page-aware chunking.
 *
 * Text is split into sentence units that remember their page and chapter,
 * then packed into ~250-word chunks that prefer to end on paragraph
 * boundaries, never cross a chapter boundary, and overlap by a sentence or
 * two so an idea split across a boundary is still retrievable. Every chunk
 * knows the exact page range its text came from.
 */

export interface Chunk {
  ordinal: number;
  text: string;
  pageStart: number;
  pageEnd: number;
  chapter: string | null;
  wordCount: number;
}

export interface ChunkOptions {
  targetWords: number;
  maxWords: number;
  minWords: number;
  overlapWords: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  targetWords: 250,
  maxWords: 340,
  minWords: 40,
  overlapWords: 45,
};

interface Unit {
  text: string;
  words: number;
  page: number;
  chapter: string | null;
  paragraphStart: boolean;
  heading: boolean;
  /** Join to the previous unit without a space (word hyphenated across a page break). */
  glue?: boolean;
}

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

function countWords(s: string): number {
  const m = s.match(/\S+/g);
  return m ? m.length : 0;
}

function sentences(text: string, maxWords: number): string[] {
  const out: string[] = [];
  for (const { segment } of segmenter.segment(text)) {
    const s = segment.trim();
    if (!s) continue;
    const words = s.split(/\s+/);
    if (words.length <= maxWords) out.push(s);
    else for (let i = 0; i < words.length; i += maxWords) out.push(words.slice(i, i + maxWords).join(" "));
  }
  return out;
}

function toUnits(paragraphs: Paragraph[], maxWords: number): Unit[] {
  const units: Unit[] = [];
  for (const p of paragraphs) {
    if (p.heading) {
      units.push({ text: p.text, words: countWords(p.text), page: p.page, chapter: p.chapter, paragraphStart: true, heading: true });
      continue;
    }
    sentences(p.text, maxWords).forEach((s, i) =>
      units.push({
        text: s,
        words: countWords(s),
        page: p.page,
        chapter: p.chapter,
        paragraphStart: i === 0 && !p.continues,
        heading: false,
        glue: i === 0 && p.continues === "nospace",
      }),
    );
  }
  return units;
}

export function chunkParagraphs(paragraphs: Paragraph[], opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS): Chunk[] {
  const units = toUnits(paragraphs, opts.maxWords);
  const chunks: Chunk[] = [];
  let cur: Unit[] = [];
  let curWords = 0;
  /** Units at the start of `cur` that were carried over as overlap. */
  let carried = 0;

  const join = (us: Unit[]) =>
    us
      .map((u, i) => (i === 0 ? u.text : (u.paragraphStart ? "\n\n" : u.glue ? "" : " ") + u.text))
      .join("")
      .trim();
  const bodyTexts: string[] = [];

  const emit = () => {
    if (cur.length - carried <= 0) return;
    const text = join(cur);
    const body = cur.slice(carried);
    bodyTexts.push(join(body));
    chunks.push({
      ordinal: chunks.length,
      text,
      pageStart: Math.min(...cur.map((u) => u.page)),
      pageEnd: Math.max(...cur.map((u) => u.page)),
      chapter: body[0].chapter,
      wordCount: curWords,
    });
  };

  const reset = (withOverlap: boolean) => {
    if (withOverlap) {
      const keep: Unit[] = [];
      let w = 0;
      for (let i = cur.length - 1; i >= 0 && keep.length < 2; i--) {
        const u = cur[i];
        if (u.heading || w + u.words > opts.overlapWords) break;
        keep.unshift(u);
        w += u.words;
      }
      cur = keep;
      curWords = w;
      carried = keep.length;
    } else {
      cur = [];
      curWords = 0;
      carried = 0;
    }
  };

  for (const u of units) {
    const last = cur[cur.length - 1];
    const chapterChange = last !== undefined && u.chapter !== last.chapter;
    const bodyWords = curWords - cur.slice(0, carried).reduce((a, x) => a + x.words, 0);

    if (chapterChange || (u.heading && bodyWords >= opts.minWords)) {
      emit();
      reset(false);
    } else if (curWords + u.words > opts.maxWords) {
      emit();
      reset(true);
    } else if (curWords >= opts.targetWords && u.paragraphStart) {
      emit();
      reset(true);
    } else if (curWords >= opts.targetWords * 1.15) {
      emit();
      reset(true);
    }
    cur.push(u);
    curWords += u.words;
  }
  emit();

  // Fold tiny trailing fragments into their predecessor within a chapter.
  // (Only the fragment's own text is appended, not its overlap.)
  const merged: Chunk[] = [];
  chunks.forEach((c, i) => {
    const prev = merged[merged.length - 1];
    const own = bodyTexts[i];
    const ownWords = countWords(own);
    if (prev && ownWords < opts.minWords && prev.chapter === c.chapter && prev.wordCount + ownWords <= opts.maxWords + opts.minWords) {
      prev.text += (own.startsWith("\n") ? "" : " ") + own;
      prev.pageEnd = Math.max(prev.pageEnd, c.pageEnd);
      prev.wordCount += ownWords;
    } else {
      merged.push({ ...c, ordinal: merged.length });
    }
  });
  return merged;
}
