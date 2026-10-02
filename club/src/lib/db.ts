import pg from "pg";

// Dates come back as plain "YYYY-MM-DD" strings rather than local-midnight Date objects.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

const globalForDb = globalThis as unknown as { __clubPool?: pg.Pool };

/** Process-wide connection pool (survives dev hot reloads). */
export function db(): pg.Pool {
  if (!globalForDb.__clubPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set (see .env.example).");
    globalForDb.__clubPool = new pg.Pool({
      connectionString,
      max: 5,
      ssl: /sslmode=require|neon\.tech|supabase/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalForDb.__clubPool;
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
