import { NextResponse } from "next/server";
import { isUuid } from "@/lib/documents";
import { hybridSearch } from "@/lib/search/hybrid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/search?q=...&doc=<id>[&doc=<id>]&limit=20 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ hits: [] });
  const documentIds = url.searchParams.getAll("doc").filter(isUuid);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const t0 = Date.now();
  const hits = await hybridSearch(q.slice(0, 1000), { documentIds, limit });
  return NextResponse.json({ hits, tookMs: Date.now() - t0 });
}
