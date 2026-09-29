import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createDocumentFromUpload, listDocuments, UploadError } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ documents: await listDocuments() });
}

/** Upload one PDF (multipart field "file"). */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload with a 'file' field." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > config.maxUploadMb * 1024 * 1024)
    return NextResponse.json({ error: `"${file.name}" exceeds the ${config.maxUploadMb} MB upload limit.` }, { status: 413 });

  try {
    const result = await createDocumentFromUpload(file.name, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 415 });
    console.error(err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
