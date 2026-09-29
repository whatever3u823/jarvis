import type { PoolClient } from "pg";
import { db, toVector } from "../db";
import { getEmbedder } from "../embed";

/**
 * Hybrid retrieval: semantic (pgvector cosine) + keyword (Postgres full-text)
 * fused with Reciprocal Rank Fusion, then lightly diversified across books.
 */

export interface SearchOptions {
  /** Restrict to these documents (e.g. "search within this book"). */
  documentIds?: string[];
  limit?: number;
  /** Drop results that overlap an already-selected neighbouring passage. */
  collapseAdjacent?: boolean;
  /** Soft cap on how much one book can dominate a library-wide result list. */
  diversify?: boolean;
  /** Retrieval legs to use (for evaluation and debugging); default both. */
  mode?: "hybrid" | "vector" | "keyword";
  /** Maximum score boost for passages matching the query's rare terms. */
  keywordBoost?: number;
}

export interface SearchHit {
  chunkId: number;
  documentId: string;
  title: string;
  author: string | null;
  chapter: string | null;
  pageStart: number;
  pageEnd: number;
  pageLabelStart: string | null;
  pageLabelEnd: string | null;
  ordinal: number;
  text: string;
  /** Text fragments with \u0001…\u0002 around keyword matches. */
  headline: string;
  /** Cosine similarity between query and passage (0..1). */
  similarity: number;
  /** Ranking score: similarity plus keyword boost (higher is better). */
  score: number;
  vectorRank: number | null;
  keywordRank: number | null;
}

const CANDIDATES = 60;
/**
 * Fusion: cosine similarity is the primary score; a passage containing the
 * query's rare terms gets up to KEYWORD_BOOST added (in cosine units, where
 * the gap between a relevant and a merely related passage is typically
 * 0.02–0.08). Measured with scripts/eval-retrieval.ts.
 */
const KEYWORD_BOOST = 0.015;
const DIVERSITY_PENALTY = 0.006;
/** Query terms occurring in more than this share of passages carry no signal. */
const MAX_TERM_DF = 0.04;

/**
 * Words that describe the *request* rather than the subject ("what do these
 * books say about suffering"). They are dropped from the keyword query only;
 * the semantic query keeps the full phrasing.
 */
const REQUEST_WORDS = new Set(
  (
    "book books author authors say says said discuss discusses discussed discussion passage passages find show " +
    "where what which how why when does do did text texts library mention mentions mentioned talk talks write writes " +
    "wrote writing idea ideas concept concepts view views think thinks compare comparison describe describes " +
    "these those about regarding explain explains meaning mean means quote quotes chapter chapters page pages " +
    "please tell give list"
  ).split(" "),
);

/** Build an OR-style tsquery string from the salient words of the query. */
export function keywordQuery(query: string): { text: string; mode: "or" | "web" } | null {
  if (/"[^"]+"/.test(query)) return { text: query, mode: "web" }; // explicit phrase search
  const words = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ""))
    .filter((w) => w.length > 1 && !REQUEST_WORDS.has(w));
  if (words.length === 0) return null;
  return { text: words.join(" "), mode: "or" };
}

/**
 * Postgres full-text ranking has no IDF, so an OR over common words ("people",
 * "life") matches a large share of the corpus and drowns out the semantic
 * results. Keep only query lexemes that are rare in the corpus. Counting is
 * capped, so rejecting a common term costs little.
 */
async function informativeLexemes(client: PoolClient, text: string): Promise<string[]> {
  const { rows } = await client.query<{ lexeme: string }>(
    `select distinct lexeme from unnest(to_tsvector('english', $1)) as t(lexeme, positions, weights)`,
    [text],
  );
  if (rows.length === 0) return [];
  const total = await chunkCount(client);
  const cap = Math.max(25, Math.ceil(total * MAX_TERM_DF));
  const keep: string[] = [];
  for (const { lexeme } of rows) {
    const { rows: c } = await client.query<{ n: number }>(
      `select count(*)::int as n from (select 1 from chunks where tsv @@ to_tsquery('simple', $1) limit ${cap + 1}) t`,
      [quoteLexeme(lexeme)],
    );
    if (c[0].n > 0 && c[0].n <= cap) keep.push(quoteLexeme(lexeme));
  }
  return keep;
}

function quoteLexeme(lx: string): string {
  return `'${lx.replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
}

let cachedCount: { n: number; at: number } | null = null;
async function chunkCount(client: PoolClient): Promise<number> {
  if (cachedCount && Date.now() - cachedCount.at < 60_000) return cachedCount.n;
  const { rows } = await client.query<{ n: number }>(`select count(*)::int as n from chunks`);
  cachedCount = { n: rows[0].n, at: Date.now() };
  return cachedCount.n;
}

function tsQuerySql(mode: "or" | "web", param: string): string {
  // plainto_tsquery handles stemming and stopwords; turning & into | makes
  // natural-language questions match passages containing *any* salient term
  // (ranking rewards passages that contain more of them).
  return mode === "web"
    ? `websearch_to_tsquery('english', ${param})`
    : `nullif(replace(plainto_tsquery('english', ${param})::text, '&', '|'), '')::tsquery`;
}

export async function hybridSearch(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
  const limit = opts.limit ?? 20;
  const scoped = opts.documentIds && opts.documentIds.length > 0;
  const docFilter = scoped ? opts.documentIds! : null;
  const mode = opts.mode ?? "hybrid";
  const qvec = toVector(await getEmbedder().embedQuery(query));
  const kw = mode === "vector" ? null : keywordQuery(query);

  const client = await db().connect();
  let vectorRows: { id: string }[] = [];
  let keywordRows: { id: string }[] = [];
  let lexemes: string[] = [];
  try {
    await client.query("begin");
    if (mode === "keyword") {
      // keyword leg only
    } else if (scoped) {
      // Exact scan over the selected books (small), avoiding HNSW + filter recall loss.
      vectorRows = (
        await client.query(
          `with scoped as materialized (select id, embedding from chunks where document_id = any($2::uuid[]))
           select id from scoped order by embedding <=> $1::vector limit ${CANDIDATES}`,
          [qvec, docFilter],
        )
      ).rows;
    } else {
      await client.query("set local hnsw.ef_search = 120");
      vectorRows = (
        await client.query(`select id from chunks order by embedding <=> $1::vector limit ${CANDIDATES}`, [qvec])
      ).rows;
    }
    if (kw) {
      // Quoted phrases are matched exactly; otherwise any of the query's rare terms.
      if (kw.mode === "or") lexemes = await informativeLexemes(client, kw.text);
      const param = kw.mode === "web" ? kw.text : lexemes.join(" | ");
      if (param) {
        const qSql = kw.mode === "web" ? tsQuerySql("web", "$1") : "to_tsquery('simple', $1)";
        keywordRows = (
          await client.query(
            `select c.id from chunks c, (select ${qSql} as q) t
             where c.tsv @@ t.q ${scoped ? "and c.document_id = any($2::uuid[])" : ""}
             order by ts_rank_cd(c.tsv, t.q, 32) desc limit ${CANDIDATES}`,
            scoped ? [param, docFilter] : [param],
          )
        ).rows;
      }
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  const ranks = new Map<number, { v: number | null; k: number | null }>();
  vectorRows.forEach((r, i) => ranks.set(Number(r.id), { v: i + 1, k: null }));
  keywordRows.forEach((r, i) => {
    const id = Number(r.id);
    ranks.set(id, { v: ranks.get(id)?.v ?? null, k: i + 1 });
  });
  if (ranks.size === 0) return [];

  // Score every candidate by similarity, plus a bounded boost for the share of
  // the query's rare terms (or the quoted phrase) the passage contains.
  const ids = [...ranks.keys()];
  const params: unknown[] = [ids, qvec];
  let coverageSql = "0";
  if (kw?.mode === "web") {
    params.push(kw.text);
    coverageSql = `(c.tsv @@ ${tsQuerySql("web", `$${params.length}`)})::int`;
  } else if (lexemes.length) {
    params.push(lexemes);
    coverageSql = `(select count(*) from unnest($${params.length}::text[]) l where c.tsv @@ to_tsquery('simple', l))::float / ${lexemes.length}`;
  }
  let headlineSql = "null";
  if (kw) {
    params.push(kw.text);
    headlineSql = `ts_headline('english', c.text, ${tsQuerySql(kw.mode, `$${params.length}`)},
                     'StartSel=\u0001, StopSel=\u0002, MaxFragments=2, MaxWords=38, MinWords=18, FragmentDelimiter=" … "')`;
  }
  const { rows } = await db().query(
    `select c.id, c.document_id, c.ordinal, c.page_start, c.page_end, c.chapter, c.text,
            d.title, d.author, ps.label as label_start, pe.label as label_end,
            1 - (c.embedding <=> $2::vector) as similarity,
            ${coverageSql} as coverage,
            ${headlineSql} as headline
     from chunks c
     join documents d on d.id = c.document_id
     left join pages ps on ps.document_id = c.document_id and ps.page = c.page_start
     left join pages pe on pe.document_id = c.document_id and pe.page = c.page_end
     where c.id = any($1::bigint[])`,
    params,
  );

  const boost = opts.keywordBoost ?? KEYWORD_BOOST;
  let hits: SearchHit[] = rows.map((r) => {
    const rk = ranks.get(Number(r.id))!;
    const similarity = Number(r.similarity);
    const coverage = Number(r.coverage) || 0;
    return {
      chunkId: Number(r.id),
      documentId: r.document_id,
      title: r.title,
      author: r.author,
      chapter: r.chapter,
      pageStart: r.page_start,
      pageEnd: r.page_end,
      pageLabelStart: r.label_start,
      pageLabelEnd: r.label_end,
      ordinal: r.ordinal,
      text: r.text,
      headline: r.headline && r.headline.includes("\u0001") ? r.headline : leadExcerpt(r.text),
      similarity,
      score: mode === "keyword" ? -(rk.k ?? 1e9) : similarity + boost * coverage,
      vectorRank: rk.v,
      keywordRank: rk.k,
    };
  });
  hits.sort((a, b) => b.score - a.score);

  if (opts.collapseAdjacent ?? true) {
    const taken = new Set<string>();
    hits = hits.filter((h) => {
      const near = [h.ordinal - 1, h.ordinal, h.ordinal + 1].some((o) => taken.has(`${h.documentId}:${o}`));
      if (near) return false;
      taken.add(`${h.documentId}:${h.ordinal}`);
      return true;
    });
  }

  if ((opts.diversify ?? !scoped) && hits.length > limit) {
    // Beyond the first few passages from one book, each further one counts a
    // little less, so library-wide results show breadth.
    const seen = new Map<string, number>();
    const adjusted = hits.map((h) => {
      const n = seen.get(h.documentId) ?? 0;
      seen.set(h.documentId, n + 1);
      return { h, s: h.score - DIVERSITY_PENALTY * Math.max(0, n - 2) };
    });
    adjusted.sort((a, b) => b.s - a.s);
    hits = adjusted.map((a) => a.h);
  }

  return hits.slice(0, limit);
}

function leadExcerpt(text: string, words = 45): string {
  const w = text.split(/\s+/);
  return w.length <= words ? text : w.slice(0, words).join(" ") + " …";
}
