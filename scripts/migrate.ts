/** Apply SQL migrations in db/migrations that have not been applied yet. */
import "./env";
import { db } from "../src/lib/db";
import { runMigrations } from "../src/lib/migrate";

try {
  await runMigrations(console.log);
  console.log("database is up to date");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await db().end();
}
