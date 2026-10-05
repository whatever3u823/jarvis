import { NextResponse } from "next/server";
import { getDocument, reprocessDocument } from "@/lib/documents";
import { scheduleInlineJobs } from "@/lib/ingest/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getDocument(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await reprocessDocument(id);
  await scheduleInlineJobs();
  return NextResponse.json({ ok: true });
}
