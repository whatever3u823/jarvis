import { existsSync } from "node:fs";
import path from "node:path";
import { appPassword, config, hasAnthropicCredentials } from "./config";
import { db } from "./db";
import { runMigrations, storedEmbeddingDimensions } from "./migrate";

/**
 * What the deployment needs, checked at request time. Instead of failing with
 * a generic error page, the app shows this checklist until everything
 * required is in place. A reachable but empty database is initialised here.
 */
export interface SetupItem {
  key: "password" | "database" | "storage" | "embeddings" | "answers";
  label: string;
  ok: boolean;
  required: boolean;
  detail: string;
  fix?: string;
}

export interface SetupStatus {
  ready: boolean;
  items: SetupItem[];
}

let cached: { status: SetupStatus; at: number } | null = null;

export async function getSetupStatus(): Promise<SetupStatus> {
  // A healthy result is reused for a minute; problems are re-checked every request.
  if (cached && cached.status.ready && Date.now() - cached.at < 60_000) return cached.status;
  const items: SetupItem[] = [];

  if (config.onVercel) {
    items.push(
      appPassword()
        ? { key: "password", label: "Password", ok: true, required: true, detail: "The library is password-protected." }
        : {
            key: "password",
            label: "Password",
            ok: false,
            required: true,
            detail: "This deployment is reachable by anyone with the URL, so it stays locked until a password is set.",
            fix: "Add an environment variable APP_PASSWORD (Project → Settings → Environment Variables), then redeploy.",
          },
    );
  }

  items.push(await checkDatabase());

  if (config.onVercel && config.storage !== "blob") {
    items.push({
      key: "storage",
      label: "File storage",
      ok: false,
      required: true,
      detail: "Vercel functions have no persistent disk, so PDFs are kept in Vercel Blob.",
      fix: "In the Vercel project open Storage → Create → Blob and connect it to this project (this sets BLOB_READ_WRITE_TOKEN), then redeploy.",
    });
  } else {
    items.push({
      key: "storage",
      label: "File storage",
      ok: true,
      required: true,
      detail: config.storage === "blob" ? "Vercel Blob (private)." : `Local disk (${config.storageDir}).`,
    });
  }

  if (config.embeddingProvider === "voyage") {
    items.push(
      process.env.VOYAGE_API_KEY
        ? { key: "embeddings", label: "Search embeddings", ok: true, required: true, detail: `Voyage AI (${config.embeddingModel}).` }
        : {
            key: "embeddings",
            label: "Search embeddings",
            ok: false,
            required: true,
            detail: "Search and indexing use Voyage AI embeddings.",
            fix: "Create an API key at dash.voyageai.com and add it as the environment variable VOYAGE_API_KEY, then redeploy.",
          },
    );
  } else {
    const present = existsSync(path.join(config.modelsDir, config.embeddingModel, "onnx", "model.onnx"));
    items.push(
      present
        ? { key: "embeddings", label: "Search embeddings", ok: true, required: true, detail: `Local model ${config.embeddingModel}.` }
        : {
            key: "embeddings",
            label: "Search embeddings",
            ok: false,
            required: true,
            detail: `The local embedding model is not in ${config.modelsDir}.`,
            fix: "Run `npm run models:fetch`, or set VOYAGE_API_KEY to use Voyage AI instead.",
          },
    );
  }

  items.push(
    hasAnthropicCredentials()
      ? { key: "answers", label: "Answers", ok: true, required: false, detail: `Claude (${config.llmModel}).` }
      : {
          key: "answers",
          label: "Answers",
          ok: false,
          required: false,
          detail: "Optional: search works without it; Ask shows retrieved passages but cannot write answers.",
          fix: "Add ANTHROPIC_API_KEY to the environment.",
        },
  );

  const status = { ready: items.every((i) => i.ok || !i.required), items };
  cached = { status, at: Date.now() };
  return status;
}

async function checkDatabase(): Promise<SetupItem> {
  const base = { key: "database" as const, label: "Database", required: true };
  if (!config.databaseUrl) {
    return {
      ...base,
      ok: false,
      detail: "No database is configured. The library needs PostgreSQL with the pgvector extension.",
      fix: "In the Vercel project open Storage → Create → Neon (Postgres) and connect it to this project (this sets DATABASE_URL), then redeploy. The tables are created automatically.",
    };
  }
  try {
    await db().query("select 1");
  } catch (err) {
    return {
      ...base,
      ok: false,
      detail: `Could not connect to the database: ${err instanceof Error ? err.message : err}`,
      fix: "Check DATABASE_URL (it should be a postgres:// URL that this deployment can reach).",
    };
  }
  try {
    await runMigrations((m) => console.log(`[setup] ${m}`));
  } catch (err) {
    return {
      ...base,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      fix: "The database must allow `create extension vector` (pgvector). Neon and Supabase do.",
    };
  }
  const dims = await storedEmbeddingDimensions();
  if (dims !== null && dims !== config.embeddingDimensions) {
    return {
      ...base,
      ok: false,
      detail: `The database was created for ${dims}-dimensional embeddings, but the configured provider (${config.embeddingProvider}) produces ${config.embeddingDimensions}.`,
      fix: "Use the same embedding provider the library was indexed with, or start from an empty database.",
    };
  }
  return { ...base, ok: true, detail: "PostgreSQL with pgvector, schema up to date." };
}
