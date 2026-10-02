import { getCover } from "@/lib/data/books";
import { getReader } from "@/lib/session";

/** Uploaded cover images. Versioned by URL, so they can be cached for good. */
export async function GET(_req: Request, ctx: RouteContext<"/covers/[id]">) {
  if (!(await getReader())) return new Response("Members only", { status: 401 });
  const cover = await getCover(Number((await ctx.params).id));
  if (!cover) return new Response("No cover", { status: 404 });
  return new Response(new Uint8Array(cover.data), {
    headers: {
      "Content-Type": cover.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
