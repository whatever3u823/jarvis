import { NextResponse } from "next/server";
import { z } from "zod";
import { createDocumentFromUpload, UploadError } from "@/lib/documents";
import { scheduleInlineJobs } from "@/lib/ingest/runner";
import { keys, storage } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ uploadId: z.string().uuid(), fileName: z.string().min(1).max(500) });

/** Register a PDF the browser uploaded to Blob storage, then index it. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const key = keys.incoming(parsed.data.uploadId);
  try {
    const bytes = new Uint8Array(await storage.get(key));
    const result = await createDocumentFromUpload(parsed.data.fileName, bytes);
    await scheduleInlineJobs();
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 415 });
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed." }, { status: 500 });
  } finally {
    // The incoming copy is no longer needed either way.
    await import("@vercel/blob").then(({ del }) => del(key)).catch(() => {});
  }
}
