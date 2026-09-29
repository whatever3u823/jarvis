import { NextResponse } from "next/server";
import { getDocument, reprocessDocument } from "@/lib/documents";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getDocument(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await reprocessDocument(id);
  return NextResponse.json({ ok: true });
}
