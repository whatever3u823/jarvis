/**
 * Locate a passage inside a rendered page's text-layer spans.
 *
 * Both sides are reduced to lowercase letters and digits only, so differences
 * in spacing, punctuation, hyphenation at line breaks and ligatures don't
 * matter. The target is matched in fixed-size windows (a chunk may start on
 * the previous page or continue onto the next one, and may skip a running
 * header), and the matched ranges are mapped back to span indexes.
 */

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const WINDOW = 28;
const MAX_GAP = 80;

export function findHighlightRanges(spanTexts: string[], target: string): number[] {
  let page = "";
  const owner: number[] = [];
  spanTexts.forEach((t, i) => {
    const n = norm(t);
    page += n;
    for (let k = 0; k < n.length; k++) owner.push(i);
  });
  const t = norm(target);
  if (!page || t.length < 8) return [];

  const ranges: [number, number][] = [];
  const whole = page.indexOf(t);
  if (whole >= 0) {
    ranges.push([whole, whole + t.length]);
  } else {
    let cursor = 0;
    const starts: number[] = [];
    for (let i = 0; i + WINDOW <= t.length; i += WINDOW) starts.push(i);
    if (t.length > WINDOW) starts.push(t.length - WINDOW);
    for (const i of starts) {
      const w = t.slice(i, i + WINDOW);
      const pos = page.indexOf(w, cursor);
      if (pos < 0) continue;
      const last = ranges[ranges.length - 1];
      // Windows must progress through the page in order and stay close together.
      if (last && pos - last[1] > MAX_GAP * 6) continue;
      ranges.push([pos, pos + WINDOW]);
      cursor = pos + 1;
    }
  }
  if (ranges.length === 0) return [];

  // Merge nearby ranges (bridging small mismatches such as footnote markers).
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] <= MAX_GAP) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const spans = new Set<number>();
  for (const [a, b] of merged) for (let k = a; k < b; k++) spans.add(owner[k]);
  return [...spans].sort((x, y) => x - y);
}
