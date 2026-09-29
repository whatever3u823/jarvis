/** Formatting helpers shared by server and client code (no Node imports). */

export function pageRange(p: {
  pageStart: number;
  pageEnd: number;
  pageLabelStart?: string | null;
  pageLabelEnd?: string | null;
}): string {
  const a = p.pageLabelStart ?? String(p.pageStart);
  const b = p.pageLabelEnd ?? String(p.pageEnd);
  return a === b ? `p. ${a}` : `pp. ${a}–${b}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** Last segment of a chapter breadcrumb ("Part I › Chapter III" -> "Chapter III"). */
export function chapterLeaf(chapter: string | null | undefined): string | null {
  if (!chapter) return null;
  const parts = chapter.split(" › ");
  const leaf = parts[parts.length - 1];
  // Bare numerals ("II", "12") mean little without their parent section.
  if (parts.length > 1 && leaf.length <= 6) return `${parts[parts.length - 2]} · ${leaf}`;
  return leaf;
}

/** A short form of a title for inline citations. */
export function shortTitle(title: string, max = 34): string {
  let t = title.split(/[:;—]/)[0].trim();
  t = t.replace(/^(a selection from|selections from|the complete|the collected)\s+(the\s+)?/i, "");
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return t;
}

export const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  processing: "Indexing",
  ready: "Ready",
  needs_ocr: "Needs OCR",
  failed: "Failed",
};
