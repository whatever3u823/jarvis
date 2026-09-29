import { z } from "zod";
import { isUuid } from "@/lib/documents";
import { ask } from "@/lib/rag/ask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  question: z.string().trim().min(1).max(4000),
  documentIds: z.array(z.string().refine(isUuid)).max(100).optional(),
  history: z.array(z.object({ question: z.string().max(4000), answer: z.string().max(100_000) })).max(20).optional(),
  priorPassages: z
    .array(z.object({ id: z.string().regex(/^P\d+$/), chunkId: z.number().int().nullable(), documentId: z.string().refine(isUuid), page: z.number().int() }))
    .max(200)
    .optional(),
});

/** Streams AskEvents as newline-delimited JSON. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: unknown) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        for await (const event of ask(parsed.data, req.signal)) send(event);
      } catch (err) {
        console.error(err);
        send({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
