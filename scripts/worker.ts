/**
 * Background ingestion worker. Claims queued jobs from Postgres and runs the
 * PDF -> text -> chunks -> embeddings pipeline. Runs alongside the web app
 * (`npm run dev` / `npm start` start both).
 */
import "./env";
import { db } from "../src/lib/db";
import { recoverInterruptedJobs } from "../src/lib/ingest/jobs";
import { runPendingJobs } from "../src/lib/ingest/runner";

const log = (msg: string) => console.log(`[worker ${new Date().toISOString().slice(11, 19)}] ${msg}`);

let stopping = false;
let wake: (() => void) | null = null;

async function main() {
  const recovered = await recoverInterruptedJobs();
  if (recovered) log(`re-queued ${recovered} interrupted job(s)`);
  await db().query(`update documents set status = 'queued', stage = 'queued'
                    where status = 'processing' and id in (select document_id from jobs where status = 'pending')`);

  // Wake immediately on new uploads; poll as a fallback.
  const listener = await db().connect();
  await listener.query("listen jarvis_jobs");
  listener.on("notification", () => wake?.());

  log("ready");
  while (!stopping) {
    await new Promise<void>((resolve) => {
      wake = resolve;
      setTimeout(resolve, 2000);
    });
    wake = null;
    if (stopping) break;
    try {
      await runPendingJobs(Number.POSITIVE_INFINITY, log);
    } catch (err) {
      log(`runner error: ${err instanceof Error ? err.message : err}`);
    }
  }
  listener.release();
  await db().end();
}

for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, () => {
    stopping = true;
    wake?.();
  });

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
