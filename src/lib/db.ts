import pg from "pg";
import { config } from "./config";

/** Thrown when the deployment is missing required configuration. */
export class SetupError extends Error {}

const globalForDb = globalThis as unknown as { __jarvisPool?: pg.Pool };

/** Process-wide connection pool (survives Next.js dev hot reloads). */
export function db(): pg.Pool {
  if (!globalForDb.__jarvisPool) {
    if (!config.databaseUrl) throw new SetupError("DATABASE_URL is not set.");
    globalForDb.__jarvisPool = new pg.Pool({
      connectionString: config.databaseUrl,
      // Serverless instances are many and short-lived: keep each one's footprint small.
      max: config.onVercel ? 3 : 10,
      idleTimeoutMillis: config.onVercel ? 10_000 : 30_000,
      connectionTimeoutMillis: 10_000,
    });
    globalForDb.__jarvisPool.on("error", (err) => console.error("[db] idle client error:", err.message));
  }
  return globalForDb.__jarvisPool;
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/** pgvector literal for a query parameter. */
export function toVector(values: number[]): string {
  return `[${values.join(",")}]`;
}
