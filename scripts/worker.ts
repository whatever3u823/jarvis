/**
 * Background ingestion worker. Claims queued jobs from Postgres and runs the
 * PDF -> text -> chunks -> embeddings pipeline. Runs alongside the web app
 * (`npm run dev` / `npm start` start both).
 */
import "./env";
import { db } from "../src/lib/db";
import { claimJob, finishJob, recoverInterruptedJobs } from "../src/lib/ingest/jobs";
import { ingestDocument } from "../src/lib/ingest/pipeline";

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
    const job = await claimJob();
    if (!job) {
      await new Promise<void>((resolve) => {
        wake = resolve;
        setTimeout(resolve, 2000);
      });
      wake = null;
      continue;
    }
    const started = Date.now();
    log(`job ${job.id}: ${job.kind} ${job.documentId} (attempt ${job.attempts})`);
    try {
      await ingestDocument(job.documentId, (m) => log(`  ${m}`));
      await finishJob(job.id);
      log(`job ${job.id}: done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`job ${job.id}: failed: ${message}`);
      await finishJob(job.id, message);
      await db().query(
        `update documents set status = 'failed', stage = null, status_detail = $2, updated_at = now() where id = $1`,
        [job.documentId, `Processing failed: ${message}`],
      );
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
