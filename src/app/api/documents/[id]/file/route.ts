import { Readable } from "node:stream";
import { getDocument } from "@/lib/documents";
import { keys, storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stream the original PDF, with HTTP range support for the in-browser reader. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return new Response("Not found", { status: 404 });
  const key = keys.original(id);
  const size = await storage.size(key);
  if (size == null) return new Response("File missing", { status: 404 });

  const download = new URL(req.url).searchParams.has("download");
  const headers: Record<string, string> = {
    "content-type": "application/pdf",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=3600",
    "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
  };

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    const body = Readable.toWeb(storage.stream(key, { start, end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  const body = Readable.toWeb(storage.stream(key)) as ReadableStream;
  return new Response(body, { headers: { ...headers, "content-length": String(size) } });
}
