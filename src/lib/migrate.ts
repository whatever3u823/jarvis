import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
import { db } from "./db";

/**
 * Apply SQL migrations from db/migrations that have not run yet. Safe to call
 * concurrently (an advisory lock serialises runners), so a fresh hosted
 * database can be initialised on first request.
 *
 * `{{EMBEDDING_DIMENSIONS}}` in a migration is replaced with the configured
 * embedding size, so the vector column matches the embedding provider.
 */
export async function runMigrations(log: (msg: string) => void = () => {}): Promise<string[]> {
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), "db", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const client = await db().connect();
  const applied: string[] = [];
  try {
    await client.query("select pg_advisory_lock(7212024)");
    await client.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
    const done = new Set((await client.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
    for (const name of files) {
      if (done.has(name)) continue;
      const sql = (await readFile(path.join(dir, name), "utf8")).replaceAll("{{EMBEDDING_DIMENSIONS}}", String(config.embeddingDimensions));
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [name]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw new Error(`Migration ${name} failed: ${err instanceof Error ? err.message : err}`);
      }
      applied.push(name);
      log(`applied ${name}`);
    }
  } finally {
    await client.query("select pg_advisory_unlock(7212024)").catch(() => {});
    client.release();
  }
  return applied;
}

/** Dimension of the chunks.embedding column, or null if the table doesn't exist yet. */
export async function storedEmbeddingDimensions(): Promise<number | null> {
  const { rows } = await db().query<{ t: string | null }>(
    `select format_type(a.atttypid, a.atttypmod) as t
     from pg_attribute a where a.attrelid = to_regclass('chunks') and a.attname = 'embedding'`,
  );
  const m = rows[0]?.t?.match(/vector\((\d+)\)/);
  return m ? Number(m[1]) : null;
}
