import { getDocument } from "@/lib/documents";
import { keys, storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stream the original PDF, with HTTP range support: the in-browser reader
 * fetches only the parts of the file it needs (and each response stays small,
 * which matters for serverless response limits).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return new Response("Not found", { status: 404 });

  const download = new URL(req.url).searchParams.has("download");
  const m = req.headers.get("range")?.match(/^bytes=(\d+)-(\d*)$/);
  const range = m ? { start: Number(m[1]), end: m[2] ? Number(m[2]) : null } : undefined;
  if (range && range.end !== null && range.end < range.start) return new Response(null, { status: 416 });

  const obj = await storage.open(keys.original(id), range);
  if (!obj) return new Response("File missing", { status: 404 });
  if (range && range.start >= obj.size) {
    await obj.body.cancel();
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${obj.size}` } });
  }

  const headers: Record<string, string> = {
    "content-type": "application/pdf",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=3600",
    "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
  };
  if (obj.range) {
    return new Response(obj.body, {
      status: 206,
      headers: {
        ...headers,
        "content-range": `bytes ${obj.range.start}-${obj.range.end}/${obj.size}`,
        "content-length": String(obj.range.end - obj.range.start + 1),
      },
    });
  }
  return new Response(obj.body, { headers: { ...headers, "content-length": String(obj.size) } });
}
