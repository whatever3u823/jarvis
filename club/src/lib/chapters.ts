/**
 * A book is divided into a prelude (thoughts before reading), its chapters
 * 1..n, and an afterword (thoughts once it's over). The sentinels sort
 * naturally, which is what makes the spoiler rule a single comparison.
 */
export const PRELUDE = 0;
export const AFTERWORD = 9999;

const NUMERALS: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function roman(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return String(n);
  let out = "";
  for (const [value, glyph] of NUMERALS) {
    while (n >= value) {
      out += glyph;
      n -= value;
    }
  }
  return out;
}

export function chapterLabel(chapter: number): string {
  if (chapter === PRELUDE) return "Prelude";
  if (chapter === AFTERWORD) return "Afterword";
  return `Chapter ${roman(chapter)}`;
}

/** Compact form for tight places: "Pr.", "XII", "Aft." */
export function chapterShort(chapter: number): string {
  if (chapter === PRELUDE) return "Pr.";
  if (chapter === AFTERWORD) return "Aft.";
  return roman(chapter);
}

export function chapterGloss(chapter: number): string | null {
  if (chapter === PRELUDE) return "before the first page";
  if (chapter === AFTERWORD) return "after the last page";
  return null;
}

/** Every section a note can belong to, in reading order. */
export function sections(totalChapters: number | null): number[] {
  const n = Math.max(0, totalChapters ?? 0);
  return [PRELUDE, ...Array.from({ length: n }, (_, i) => i + 1), AFTERWORD];
}

export function isValidSection(chapter: number, totalChapters: number | null): boolean {
  if (chapter === PRELUDE || chapter === AFTERWORD) return true;
  if (!Number.isInteger(chapter) || chapter < 1) return false;
  return totalChapters == null || chapter <= totalChapters;
}

export interface ProgressInput {
  chapter: number;
  page: number | null;
  finished: boolean;
}

/** Fraction of the book read, 0..1. Pages win over chapters when both are known. */
export function fractionRead(p: ProgressInput, book: { total_pages: number | null; total_chapters: number | null }): number {
  if (p.finished) return 1;
  if (p.page != null && book.total_pages) return clamp(p.page / book.total_pages);
  if (p.chapter > 0 && book.total_chapters) return clamp((p.chapter - 1) / book.total_chapters);
  return 0;
}

function clamp(x: number): number {
  return Math.min(1, Math.max(0, x));
}
