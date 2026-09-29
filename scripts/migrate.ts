/** Apply SQL migrations in db/migrations that have not been applied yet. */
import "./env";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";

const dir = path.join(process.cwd(), "db", "migrations");
const pool = db();
await pool.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
const applied = new Set((await pool.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));

for (const name of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
  if (applied.has(name)) continue;
  const sql = await readFile(path.join(dir, name), "utf8");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into schema_migrations (name) values ($1)", [name]);
    await client.query("commit");
    console.log(`applied ${name}`);
  } catch (err) {
    await client.query("rollback");
    console.error(`failed ${name}:`, err);
    process.exit(1);
  } finally {
    client.release();
  }
}
console.log("database is up to date");
await pool.end();
