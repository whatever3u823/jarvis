/**
 * Post-hoc checks on a generated answer:
 *  - every [P#] citation must refer to a passage that was actually retrieved;
 *  - every quotation must appear verbatim in a retrieved passage.
 * The UI marks anything that fails, so an unsupported quote can't pass silently.
 */

export interface CitationCheck {
  cited: string[];
  unknown: string[];
}

export interface QuoteCheck {
  quote: string;
  verified: boolean;
  /** Passages that contain the quote. */
  foundIn: string[];
}

const CITE_GROUP_RE = /\[((?:P\d+)(?:\s*[,;]\s*P\d+)*)\]/g;

export function extractCitations(text: string): string[] {
  const ids: string[] = [];
  for (const m of text.matchAll(CITE_GROUP_RE)) for (const id of m[1].split(/\s*[,;]\s*/)) ids.push(id);
  return ids;
}

export function checkCitations(text: string, known: Set<string>): CitationCheck {
  const cited = [...new Set(extractCitations(text))];
  return { cited: cited.filter((c) => known.has(c)), unknown: cited.filter((c) => !known.has(c)) };
}

/** Lowercase, unify quotes/dashes, drop punctuation, collapse whitespace. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/(\p{L})-\s+(\p{L})/gu, "$1$2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// “…” or "…" spans of at least four words.
const QUOTE_RE = /[“"]([^“”"]{12,}?)[”"]/g;

export function extractQuotes(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(QUOTE_RE)) {
    const q = m[1].trim();
    if (q.split(/\s+/).length >= 4) out.push(q);
  }
  return out;
}

export function checkQuotes(text: string, passages: { id: string; text: string }[]): QuoteCheck[] {
  const normalized = passages.map((p) => ({ id: p.id, text: normalizeForMatch(p.text) }));
  return extractQuotes(text).map((quote) => {
    // Allow ellipses and editorial [brackets]: every remaining fragment must match.
    const fragments = quote
      .replace(/\[[^\]]*\]/g, "…")
      .split(/\s*(?:\.\s?\.\s?\.|…)\s*/)
      .map(normalizeForMatch)
      .filter((f) => f.split(" ").length >= 2);
    if (fragments.length === 0) return { quote, verified: false, foundIn: [] };
    const foundIn = normalized.filter((p) => fragments.every((f) => p.text.includes(f))).map((p) => p.id);
    return { quote, verified: foundIn.length > 0, foundIn };
  });
}
