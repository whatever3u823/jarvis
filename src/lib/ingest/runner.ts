import { db } from "../db";
import { claimJob, finishJob } from "./jobs";
import { ingestDocument } from "./pipeline";

/**
 * Process queued jobs in the current process until the queue is empty or the
 * time budget is spent. The local worker loops on this; on Vercel it runs via
 * `after()` once the upload response has been sent.
 */
export async function runPendingJobs(budgetMs = 240_000, log: (msg: string) => void = console.log): Promise<number> {
  const started = Date.now();
  let processed = 0;
  while (Date.now() - started < budgetMs) {
    const job = await claimJob();
    if (!job) break;
    const t0 = Date.now();
    log(`[jobs] ${job.kind} ${job.documentId} (attempt ${job.attempts})`);
    try {
      await ingestDocument(job.documentId, (m) => log(`[jobs]   ${m}`));
      await finishJob(job.id);
      log(`[jobs] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`[jobs] failed: ${message}`);
      await finishJob(job.id, message);
      await db().query(
        `update documents set status = 'failed', stage = null, status_detail = $2, updated_at = now() where id = $1`,
        [job.documentId, `Processing failed: ${message}`],
      );
    }
    processed++;
  }
  return processed;
}

/** Schedule queue processing after the current response, when running without a worker. */
export async function scheduleInlineJobs(): Promise<void> {
  const { config } = await import("../config");
  if (!config.inlineJobs) return;
  const { after } = await import("next/server");
  after(() => runPendingJobs().then(() => undefined, (err) => console.error("[jobs] runner error:", err)));
}
