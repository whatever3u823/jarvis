import pg from "pg";
import { config } from "./config";

const globalForDb = globalThis as unknown as { __jarvisPool?: pg.Pool };

/** Process-wide connection pool (survives Next.js dev hot reloads). */
export function db(): pg.Pool {
  if (!globalForDb.__jarvisPool) {
    globalForDb.__jarvisPool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
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
