import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { rows } = await db().query(
    `select id, document_id, page_start, page_end, chapter, text from chunks where id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    chunk: { id: Number(r.id), documentId: r.document_id, pageStart: r.page_start, pageEnd: r.page_end, chapter: r.chapter, text: r.text },
  });
}
