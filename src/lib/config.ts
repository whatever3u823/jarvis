import path from "node:path";

/**
 * Central configuration, read from the environment (.env is loaded by Next.js
 * for the web app and by `scripts/env.ts` for the worker and CLI scripts).
 *
 * Two deployment shapes share one codebase:
 *  - local: Postgres on localhost, PDFs on disk, the embedding model running
 *    in-process, and a background worker (`npm run dev`);
 *  - hosted (Vercel): Postgres from DATABASE_URL (e.g. Neon), PDFs in Vercel
 *    Blob, embeddings from Voyage AI, and indexing run right after upload.
 * Each piece is chosen from the environment, so they can also be mixed.
 */
function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value !== undefined && value !== "") return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable ${name}`);
}

function optional(...names: string[]): string | null {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return null;
}

const root = process.cwd();
const onVercel = Boolean(process.env.VERCEL);

const embeddingProvider = (optional("EMBEDDING_PROVIDER") ?? (process.env.VOYAGE_API_KEY || onVercel ? "voyage" : "local")) as
  | "local"
  | "voyage";

export const config = {
  onVercel,

  /** Null when not configured (only possible on a hosted deployment). */
  databaseUrl: optional("DATABASE_URL", "POSTGRES_URL") ?? (onVercel ? null : "postgres://jarvis:jarvis@localhost:5432/jarvis"),

  /** "blob" (Vercel Blob) when a Blob token is present, otherwise the local disk. */
  storage: (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local") as "blob" | "local",
  /** Where original PDFs and generated covers are stored in local mode. */
  storageDir: path.resolve(/*turbopackIgnore: true*/ root, env("STORAGE_DIR", "./data/storage")),

  embeddingProvider,
  /** Local embedding model (ONNX, run in-process via transformers.js). */
  modelsDir: path.resolve(/*turbopackIgnore: true*/ root, env("MODELS_DIR", "./models")),
  embeddingModel: embeddingProvider === "voyage" ? env("VOYAGE_MODEL", "voyage-3.5") : env("EMBEDDING_MODEL", "bge-base-en-v1.5"),
  /** Must match the vector column dimension in the database (set when the schema is created). */
  embeddingDimensions: Number(env("EMBEDDING_DIMENSIONS", embeddingProvider === "voyage" ? "1024" : "768")),
  /** Instruction prefix bge-*-v1.5 models expect on retrieval queries (local model only). */
  embeddingQueryPrefix: env("EMBEDDING_QUERY_PREFIX", "Represent this sentence for searching relevant passages: "),
  voyageApiUrl: env("VOYAGE_API_URL", "https://api.voyageai.com/v1"),

  /**
   * Run queued indexing jobs inside the web process right after an upload
   * (needed on Vercel, where there is no long-running worker).
   */
  inlineJobs: process.env.INLINE_JOBS ? process.env.INLINE_JOBS === "1" : onVercel,

  /** Claude, used only for answering questions over retrieved passages. */
  llmModel: env("LLM_MODEL", "claude-opus-5-5"),
  llmEffort: env("LLM_EFFORT", "medium") as "low" | "medium" | "high" | "xhigh" | "max",

  /** Upload limit in megabytes. */
  maxUploadMb: Number(env("MAX_UPLOAD_MB", "300")),
} as const;

export function hasAnthropicCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Shared password protecting the app; required on a public (Vercel) deployment. */
export function appPassword(): string | null {
  return process.env.APP_PASSWORD || null;
}
