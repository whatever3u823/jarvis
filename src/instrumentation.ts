/** Warm up the embedding model when the server starts so the first search is fast. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEmbedder } = await import("./lib/embed");
  getEmbedder()
    .embedQuery("warm up")
    .catch((err) => console.warn(`[jarvis] embedding model not ready: ${err instanceof Error ? err.message : err}`));
}
