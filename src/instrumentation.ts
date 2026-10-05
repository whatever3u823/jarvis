/**
 * Runs once per server instance, before it handles requests:
 *  - brings the database schema up to date (a fresh hosted database gets its
 *    tables here, so no page can query before they exist);
 *  - warms up the local embedding model, so the first search is fast.
 * Failures are only logged; the setup screen reports what is missing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { config } = await import("./lib/config");

  if (config.databaseUrl) {
    try {
      const { runMigrations } = await import("./lib/migrate");
      await runMigrations((m) => console.log(`[jarvis] ${m}`));
    } catch (err) {
      console.warn(`[jarvis] database not ready: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (config.embeddingProvider === "local") {
    const { getEmbedder } = await import("./lib/embed");
    getEmbedder()
      .embedQuery("warm up")
      .catch((err) => console.warn(`[jarvis] embedding model not ready: ${err instanceof Error ? err.message : err}`));
  }
}
