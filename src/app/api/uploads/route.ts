import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/**
 * Issues short-lived tokens so the browser can upload a PDF straight to Vercel
 * Blob (serverless request bodies are capped at a few MB, books are not).
 */
export async function POST(req: Request) {
  if (config.storage !== "blob") return NextResponse.json({ error: "Direct uploads need Vercel Blob storage." }, { status: 400 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^incoming\/[0-9a-f-]{36}\.pdf$/.test(pathname)) throw new Error("Invalid upload path.");
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: config.maxUploadMb * 1024 * 1024,
          addRandomSuffix: false,
          validUntil: Date.now() + 30 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed." }, { status: 400 });
  }
}
