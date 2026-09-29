import path from "node:path";

/**
 * Central configuration, read from the environment (.env is loaded by Next.js
 * for the web app and by `scripts/env.ts` for the worker and CLI scripts).
 */
function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value !== undefined && value !== "") return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable ${name}`);
}

const root = process.cwd();

export const config = {
  databaseUrl: env("DATABASE_URL", "postgres://jarvis:jarvis@localhost:5432/jarvis"),

  /** Where original PDFs and generated covers are stored. */
  storageDir: path.resolve(/*turbopackIgnore: true*/ root, env("STORAGE_DIR", "./data/storage")),

  /** Local embedding model (ONNX, run in-process via transformers.js). */
  modelsDir: path.resolve(/*turbopackIgnore: true*/ root, env("MODELS_DIR", "./models")),
  embeddingModel: env("EMBEDDING_MODEL", "bge-base-en-v1.5"),
  /** Must match the vector column dimension in the database schema. */
  embeddingDimensions: 768,
  /** Instruction prefix bge-*-v1.5 models expect on retrieval queries. */
  embeddingQueryPrefix: env(
    "EMBEDDING_QUERY_PREFIX",
    "Represent this sentence for searching relevant passages: ",
  ),

  /** Claude, used only for answering questions over retrieved passages. */
  llmModel: env("LLM_MODEL", "claude-opus-5-5"),
  llmEffort: env("LLM_EFFORT", "medium") as "low" | "medium" | "high" | "xhigh" | "max",

  /** Upload limit in megabytes. */
  maxUploadMb: Number(env("MAX_UPLOAD_MB", "300")),
} as const;

export function hasAnthropicCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
