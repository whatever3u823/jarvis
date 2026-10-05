<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Jarvis project notes

Private PDF library: Next.js 16 app router (`src/app`), a separate ingestion worker (`scripts/worker.ts`), Postgres + pgvector. See README.md for the architecture.

- Two deployment shapes (`src/lib/config.ts`): local (Docker Postgres, disk, local embeddings, worker) and Vercel (Neon, Blob, Voyage, inline jobs via `after()`, `APP_PASSWORD` gate in `src/proxy.ts`). Keep both working; `src/lib/setup.ts` reports what a deployment is missing.
- Run: `npm run dev` (web + worker). Checks: `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run eval:retrieval`.
- Grounding is the core invariant: the model cites server-issued passage IDs (`src/lib/rag/passages.ts`); citations and quotations are verified after generation (`src/lib/rag/verify.ts`). Don't let the model or UI produce free-text page references.
- Chunk page ranges must stay exact: run `npm run eval:retrieval` (page accuracy) after touching `src/lib/pdf/extract.ts` or `src/lib/ingest/chunk.ts`.
- Search ranking changes should be justified with `npm run eval:retrieval` numbers, not intuition.
- Browser code uses the pdf.js *legacy* build (polyfills for newer JS APIs); `scripts/copy-pdf-worker.mjs` copies its worker into `public/`.
- Claude API usage follows the current Anthropic SDK (`client.beta.messages.stream`, adaptive thinking by default, `output_config.effort`, `fallbacks: "default"`).
