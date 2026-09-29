/** Parsing of generated answers, shared by the UI and tests. */

export type Segment = { kind: "text" | "synthesis" | "outside"; body: string };

/** Split an answer into plain / <synthesis> / <outside> segments (tolerates a partial stream). */
export function segmentAnswer(raw: string): Segment[] {
  const text = raw.replace(/<\/?[a-z]*$/i, ""); // hide a tag that is still streaming in
  const segs: Segment[] = [];
  let mode: Segment["kind"] = "text";
  for (const part of text.split(/(<\/?(?:synthesis|outside)>)/g)) {
    const m = part.match(/^<(\/?)(synthesis|outside)>$/);
    if (m) {
      mode = m[1] ? "text" : (m[2] as Segment["kind"]);
      continue;
    }
    if (!part.trim()) continue;
    const last = segs[segs.length - 1];
    if (last && last.kind === mode) last.body += part;
    else segs.push({ kind: mode, body: part });
  }
  return segs;
}

/** [P3] / [P3, P7] / [P3][P7] → markdown links the renderer turns into citation chips. */
export function linkCitations(md: string): string {
  return md.replace(/\[((?:P\d+)(?:\s*[,;]\s*P\d+)*)\]/g, (_m, ids: string) =>
    ids
      .split(/\s*[,;]\s*/)
      .map((id) => `[${id}](cite:${id})`)
      .join(""),
  );
}
