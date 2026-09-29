import { isUuid } from "@/lib/documents";
import { keys, storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  try {
    const jpg = await storage.get(keys.cover(id));
    return new Response(new Uint8Array(jpg), {
      headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
