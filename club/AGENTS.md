<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Club notes

Private two-person book club (Next.js 16 app router + Postgres via `pg`). See README.md.

- Run: `npm run dev`. Checks: `npm run typecheck`, `npm test`, `npm run build`. Schema changes go in a new file in `db/migrations`.
- Spoiler protection is the core invariant: thoughts reach the UI only through `redact()` (`src/lib/spoilers.ts`), which strips sealed text on the server. Never send raw `Thought` rows for another member's notes to a client component.
- Personal details belong in `src/club.config.ts`, not in components or the database.
- Members are referred to as "the monkey" and "the cat" in UI copy; avoid gendered pronouns for the monkey.
