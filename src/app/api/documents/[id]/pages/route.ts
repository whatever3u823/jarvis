import { NextResponse } from "next/server";
import { getPages, isUuid } from "@/lib/documents";

export const runtime = "nodejs";

/** Extracted text for a page range (?from=&to=), used by the reader for highlighting. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const from = Math.max(1, Number(url.searchParams.get("from") ?? 1));
  const to = Math.min(from + 20, Number(url.searchParams.get("to") ?? from));
  return NextResponse.json({ pages: await getPages(id, from, to) });
}
