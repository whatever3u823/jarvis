import { db } from "../db";

/**
 * A minimal durable job queue in Postgres. The worker claims jobs with
 * FOR UPDATE SKIP LOCKED, so several workers could run safely in parallel.
 */

export type JobKind = "ingest";

export interface Job {
  id: number;
  documentId: string;
  kind: JobKind;
  attempts: number;
}

export async function enqueueJob(documentId: string, kind: JobKind): Promise<void> {
  // Avoid piling up duplicate pending jobs for the same document.
  await db().query(
    `insert into jobs (document_id, kind)
     select $1, $2 where not exists (
       select 1 from jobs where document_id = $1 and kind = $2 and status = 'pending')`,
    [documentId, kind],
  );
  await db().query("notify jarvis_jobs");
}

/** A job "running" for longer than this was abandoned (crashed worker or timed-out function). */
const STALE_AFTER = "15 minutes";

export async function claimJob(): Promise<Job | null> {
  const { rows } = await db().query(
    `update jobs set status = 'running', started_at = now(), attempts = attempts + 1
     where id = (
       select id from jobs
       where status = 'pending'
          or (status = 'running' and started_at < now() - interval '${STALE_AFTER}' and attempts < 3)
       order by created_at for update skip locked limit 1)
     returning id, document_id, kind, attempts`,
  );
  const r = rows[0];
  return r ? { id: Number(r.id), documentId: r.document_id, kind: r.kind, attempts: r.attempts } : null;
}

export async function finishJob(id: number, error?: string): Promise<void> {
  await db().query(`update jobs set status = $2, error = $3, finished_at = now() where id = $1`, [
    id,
    error ? "failed" : "done",
    error ?? null,
  ]);
}

/** Jobs left 'running' by a crashed worker go back to the queue (at most 3 attempts). */
export async function recoverInterruptedJobs(): Promise<number> {
  const { rowCount } = await db().query(
    `update jobs set status = case when attempts < 3 then 'pending' else 'failed' end,
            error = case when attempts < 3 then error else 'Interrupted too many times' end
     where status = 'running'`,
  );
  return rowCount ?? 0;
}
