# The Society of the Monkey & the Cat

A private book club for exactly two readers: the monkey and the cat. Shared shelves, two
reading ribbons, notes in the margins of every chapter, spoilers kept under wax, and an
archive that grows one finished book at a time.

## Running it

```bash
cd club
npm install
cp .env.example .env          # set DATABASE_URL and CLUB_SECRET
npm run db:migrate
npm run db:seed               # optional: sample history (Dorian Gray, The Gambler, …)
npm run dev                   # http://localhost:3000
```

Any Postgres works (local, Neon, Supabase, Railway). For deployment (Vercel, Fly, a small
VPS…) set `DATABASE_URL`, a long random `CLUB_SECRET`, and optionally `CLUB_PASSPHRASE`, a word
the threshold asks for before letting anyone choose who they are. Run `npm run db:migrate`
once against the production database. `npm run db:seed -- --force` wipes everything and
reseeds, so never run it against the real archive.

Checks: `npm run typecheck`, `npm test`, `npm run build`.

## Making it yours

Everything personal is in [`src/club.config.ts`](src/club.config.ts): names (the cat's is a
placeholder), greetings, the motto, the founding date, the habits on each profile, the time zone,
and the note at the end of the colophon. The database only stores the keys `monkey` and `cat`.

## How it fits together

- **Next.js 16 app router.** Pages are Server Components reading Postgres directly
  (`src/lib/data`). Every change is a Server Action (`src/lib/actions`) validated with zod.
- **Who is reading** is a signed cookie set at `/threshold` (`src/lib/session.ts`). It is the
  single seam for real authentication later: everything asks `getReader()` / `requireReader()`.
- **Schema** (`db/migrations`): `books`, `readings` (one per member per book: chapter, page,
  dates, rating, notes), `reading_events` (the timeline), `thoughts` (notes, with optional
  quotation, page and reply), `marks` (☞, NB, !, ?, ♡ beside a note), `seals` (spoilers you chose
  to open), `covers` (uploaded images, kept in the database so no object store is needed).
- **Chapters** are 0 = prelude (before reading), 1…n, and 9999 = afterword (after the last page).

### Spoilers

A note is sealed for you when the other person wrote it about a chapter beyond your ribbon
(`src/lib/spoilers.ts`). The afterword stays sealed until you finish; the prelude never is.
Sealed notes lose their text **on the server**, so nothing beyond your ribbon reaches the
browser. Opening one takes a press-and-hold on the wax seal; it is remembered, and it shows up in
the book's timeline ("the monkey broke the seal on Chapter XIII. Noted.").

### Room to grow

- *Authentication / invitations / more clubs*: replace the cookie in `lib/session.ts`; add a
  `members` table and a `club_id` on `books`; the `member` columns are already plain text keys.
- *AI companion*: everything it would need is already structured: who said what, about which
  chapter of which book, when, with what marks, and how far along each reader was at the time.
  Embedding `thoughts` (pgvector) and passing spoiler horizons through `redact()` would let it
  remember "you said something similar about Dorian Gray" without giving away chapter XIV.
- *Quotes, highlights, statistics, notifications, book search*: new tables beside `thoughts`;
  `lib/data/stats.ts` is where reading statistics live.

## Things you might not find on your own

There are a few. Try the ¶ at the foot of any page, typing on the desk (not in a text box),
touching the portraits, and staying up past eleven.
