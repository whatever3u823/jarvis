import { NextResponse } from "next/server";
import { scheduleInlineJobs } from "@/lib/ingest/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Nudge the indexing queue. Without a worker (Vercel), the library page calls
 * this when a volume has been waiting, e.g. after a function timed out.
 */
export async function POST() {
  await scheduleInlineJobs();
  return NextResponse.json({ ok: true }, { status: 202 });
}
