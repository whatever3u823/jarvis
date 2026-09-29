import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteDocument, getDocument, isUuid, updateDocument } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const doc = await getDocument((await params).id);
  return doc ? NextResponse.json({ document: doc }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

const Patch = z.object({
  title: z.string().max(500).optional(),
  author: z.string().max(300).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  tags: z.array(z.string().max(60)).max(50).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const doc = await updateDocument(id, parsed.data);
  return doc ? NextResponse.json({ document: doc }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = await deleteDocument(id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
