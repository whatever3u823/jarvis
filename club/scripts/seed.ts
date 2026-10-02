/**
 * Sample history so the rooms aren't empty on first look.
 *   npm run db:seed            — only into an empty archive
 *   npm run db:seed -- --force — wipe everything and re-seed
 */
import "./env";
import { db } from "../src/lib/db";
import { AFTERWORD, PRELUDE } from "../src/lib/chapters";

type Who = "monkey" | "cat";
interface SeedNote {
  who: Who;
  ch: number;
  body: string;
  quote?: string;
  page?: number;
  at: string;
  marks?: [Who, string][];
  replies?: { who: Who; body: string; at: string }[];
}
interface SeedBook {
  title: string;
  author: string;
  translator?: string;
  year?: number;
  isbn?: string;
  description: string;
  pages: number;
  chapters: number;
  status: "want" | "reading" | "finished" | "abandoned";
  started?: string;
  finished?: string;
  goal?: [number, string];
  added_by: Who;
  added_at: string;
  readings?: Partial<Record<Who, { chapter: number; page?: number; started?: string; finished?: string; rating?: number; notes?: string }>>;
  events?: [Who, "began" | "progress" | "finished" | "seal", number | null, string][];
  seals?: [Who, number, string][];
  notes?: SeedNote[];
}

const BOOKS: SeedBook[] = [
  {
    title: "The Picture of Dorian Gray",
    author: "Oscar Wilde",
    year: 1890,
    isbn: "9780141439570",
    description:
      "A beautiful young man wishes that his portrait would age instead of him, and is granted it. Lord Henry supplies the epigrams; the painting keeps the accounts.",
    pages: 254,
    chapters: 20,
    status: "finished",
    started: "2025-11-16",
    finished: "2025-12-20",
    added_by: "cat",
    added_at: "2025-11-14T21:10:00Z",
    readings: {
      monkey: { chapter: 20, page: 254, started: "2025-11-16", finished: "2025-12-20", rating: 4, notes: "Docked one lemon for chapter eleven. Otherwise: perfect, wicked, very quotable. I now say “one should never…” far too often." },
      cat: { chapter: 20, page: 254, started: "2025-11-16", finished: "2025-12-17", rating: 5, notes: "I called the ending at chapter four. I would like that on the record." },
    },
    events: [
      ["cat", "began", 1, "2025-11-16T20:00:00Z"],
      ["monkey", "began", 1, "2025-11-17T22:30:00Z"],
      ["monkey", "progress", 7, "2025-11-29T23:40:00Z"],
      ["cat", "progress", 11, "2025-12-04T19:10:00Z"],
      ["cat", "finished", 20, "2025-12-17T21:45:00Z"],
      ["monkey", "finished", 20, "2025-12-20T08:15:00Z"],
    ],
    notes: [
      { who: "cat", ch: PRELUDE, body: "I have seen the film. I'm told this doesn't count.", at: "2025-11-15T10:00:00Z" },
      { who: "monkey", ch: 1, body: "Lord Henry speaks exclusively in epigrams. I would like to be his friend for exactly one evening, and then never again.", at: "2025-11-18T22:40:00Z" },
      {
        who: "cat", ch: 2, quote: "The only way to get rid of a temptation is to yield to it.", page: 21,
        body: "Underlined twice. Not as advice.", at: "2025-11-19T20:05:00Z", marks: [["monkey", "manicule"]],
        replies: [{ who: "monkey", body: "Taking it as advice.", at: "2025-11-19T22:10:00Z" }],
      },
      { who: "monkey", ch: 7, body: "Dorian is unspeakably cruel to Sibyl Vane and I need to lie down for a moment.", at: "2025-11-29T23:45:00Z", marks: [["cat", "nb"]] },
      { who: "cat", ch: 11, body: "This entire chapter is a catalogue of things he bought. Wilde is having fun at our expense and I respect it.", at: "2025-12-04T19:20:00Z", marks: [["monkey", "query"]] },
      { who: "monkey", ch: 20, body: "The portrait. The knife. I said “oh no” out loud on the tram.", at: "2025-12-20T08:20:00Z", marks: [["cat", "heart"], ["cat", "manicule"]] },
      { who: "cat", ch: AFTERWORD, body: "Five pomegranates. It's a book about a man who never has to look at what he's done — and we spend the whole time looking.", at: "2025-12-20T19:00:00Z", marks: [["monkey", "manicule"]] },
    ],
  },
  {
    title: "The Gambler",
    author: "Fyodor Dostoevsky",
    translator: "Constance Garnett",
    year: 1866,
    description:
      "A tutor in the employ of a ruined Russian general, a spa town called Roulettenburg, a woman he would throw himself off a cliff for, and a wheel that will not stop turning.",
    pages: 192,
    chapters: 17,
    status: "finished",
    started: "2026-01-05",
    finished: "2026-02-02",
    added_by: "monkey",
    added_at: "2025-12-28T18:00:00Z",
    readings: {
      monkey: { chapter: 17, page: 192, started: "2026-01-05", finished: "2026-01-29", rating: 5, notes: "Written in 26 days to pay off a gambling debt. You can feel the clock in every sentence, and I loved it." },
      cat: { chapter: 17, page: 192, started: "2026-01-06", finished: "2026-02-02", rating: 3, notes: "Three pomegranates. The grandmother alone is worth two of them. Alexei Ivanovich is worth none." },
    },
    events: [
      ["monkey", "began", 1, "2026-01-05T21:00:00Z"],
      ["cat", "began", 1, "2026-01-06T20:00:00Z"],
      ["monkey", "progress", 9, "2026-01-15T23:50:00Z"],
      ["monkey", "finished", 17, "2026-01-29T00:40:00Z"],
      ["cat", "finished", 17, "2026-02-02T21:30:00Z"],
    ],
    notes: [
      { who: "monkey", ch: 1, body: "Everyone in Roulettenburg owes everyone else money. Very relatable.", at: "2026-01-05T21:30:00Z" },
      { who: "cat", ch: 4, body: "Polina is the only person in this book with any sense, and she is still making catastrophic decisions.", at: "2026-01-09T20:40:00Z", marks: [["monkey", "bang"]] },
      {
        who: "monkey", ch: 9, body: "The grandmother arriving in her armchair is the greatest entrance in all of literature. I will not be taking questions.", at: "2026-01-15T23:55:00Z",
        marks: [["cat", "manicule"], ["cat", "heart"]],
        replies: [{ who: "cat", body: "No questions. Only agreement.", at: "2026-01-16T08:02:00Z" }],
      },
      { who: "cat", ch: 10, quote: "Zéro!", body: "She keeps betting on zero and honestly, same.", at: "2026-01-17T21:15:00Z" },
      { who: "monkey", ch: AFTERWORD, body: "He promises himself tomorrow, every time. The whole book is the word “tomorrow”.", at: "2026-01-29T00:45:00Z", marks: [["cat", "nb"]] },
    ],
  },
  {
    title: "Ulysses",
    author: "James Joyce",
    year: 1922,
    description: "One day in Dublin, 16 June 1904, in eighteen episodes and every style the English language can be bent into.",
    pages: 730,
    chapters: 18,
    status: "abandoned",
    started: "2026-02-10",
    finished: "2026-03-01",
    added_by: "monkey",
    added_at: "2026-02-08T12:00:00Z",
    readings: {
      monkey: { chapter: 3, page: 49, started: "2026-02-10", notes: "We will come back to it. (We will not come back to it.)" },
      cat: { chapter: 4, page: 61, started: "2026-02-10" },
    },
    events: [
      ["monkey", "began", 1, "2026-02-10T20:00:00Z"],
      ["cat", "began", 1, "2026-02-10T20:05:00Z"],
      ["cat", "progress", 4, "2026-02-22T21:00:00Z"],
    ],
    notes: [
      { who: "cat", ch: PRELUDE, body: "Are we sure about this?", at: "2026-02-08T12:30:00Z", marks: [["monkey", "query"]] },
      { who: "monkey", ch: 1, quote: "Stately, plump Buck Mulligan…", page: 1, body: "So far, so good.", at: "2026-02-10T20:20:00Z" },
      { who: "cat", ch: 3, body: "I have read this page four times. Proteus is winning.", at: "2026-02-18T22:10:00Z", marks: [["monkey", "heart"]] },
    ],
  },
  {
    title: "The Master and Margarita",
    author: "Mikhail Bulgakov",
    translator: "Richard Pevear & Larissa Volokhonsky",
    year: 1967,
    isbn: "9780141180144",
    description:
      "The Devil arrives in 1930s Moscow with a retinue that includes a valet in a cracked pince-nez and an enormous black cat who walks on his hind legs. Meanwhile, in Jerusalem, a procurator has a headache.",
    pages: 384,
    chapters: 33,
    status: "reading",
    started: "2026-09-12",
    goal: [18, "2026-10-05"],
    added_by: "cat",
    added_at: "2026-09-01T19:00:00Z",
    readings: {
      monkey: { chapter: 12, page: 142, started: "2026-09-13" },
      cat: { chapter: 15, page: 181, started: "2026-09-12" },
    },
    events: [
      ["cat", "began", 1, "2026-09-12T20:30:00Z"],
      ["monkey", "began", 1, "2026-09-13T22:00:00Z"],
      ["monkey", "progress", 7, "2026-09-20T23:10:00Z"],
      ["cat", "progress", 12, "2026-09-24T21:00:00Z"],
      ["monkey", "seal", 13, "2026-09-28T23:58:00Z"],
      ["monkey", "progress", 12, "2026-09-30T22:20:00Z"],
      ["cat", "progress", 15, "2026-10-01T20:40:00Z"],
    ],
    seals: [["monkey", 13, "2026-09-28T23:58:00Z"]],
    notes: [
      { who: "monkey", ch: PRELUDE, body: "I have been told there is a large cat in this book. I have been told this as a warning.", at: "2026-09-02T09:00:00Z", marks: [["cat", "heart"]] },
      { who: "cat", ch: 1, body: "Never talk to strangers. Especially at the Patriarch's Ponds. Noted.", at: "2026-09-12T21:00:00Z" },
      {
        who: "monkey", ch: 2, body: "Pontius Pilate's headache is the most vividly written headache I have ever read. I had one in sympathy.", at: "2026-09-15T23:30:00Z",
        replies: [{ who: "cat", body: "And the swallow! Flying in and out of the colonnade while everything is decided.", at: "2026-09-16T07:45:00Z" }],
        marks: [["cat", "nb"]],
      },
      { who: "cat", ch: 7, body: "Behemoth has entered. I have found my favourite character and there is no going back.", at: "2026-09-19T20:10:00Z", marks: [["monkey", "manicule"], ["monkey", "heart"]] },
      { who: "monkey", ch: 9, body: "Woland's people feel like a travelling theatre company from hell. Koroviev is a wonderful creep.", at: "2026-09-25T22:40:00Z" },
      { who: "monkey", ch: 12, page: 128, body: "The black magic séance! Money raining from the ceiling of the Variety. Everyone in that theatre deserves exactly what is coming.", at: "2026-09-30T22:25:00Z", marks: [["cat", "bang"]] },
      { who: "cat", ch: 13, body: "And here, at last, the hero. Don't rush the part about the manuscript.", at: "2026-09-26T21:30:00Z" },
      { who: "cat", ch: 14, body: "Rimsky's chapter is properly frightening. Read it with the lamp up.", at: "2026-09-29T22:15:00Z" },
      { who: "cat", ch: 15, body: "Nikanor Ivanovich's dream is a whole little play inside the book, and the funniest thing in it so far.", at: "2026-10-01T20:45:00Z" },
    ],
  },
  {
    title: "The Leopard",
    author: "Giuseppe Tomasi di Lampedusa",
    translator: "Archibald Colquhoun",
    year: 1958,
    isbn: "9780679731214",
    description: "Sicily, 1860. Garibaldi has landed, and the Prince of Salina watches his world end with tremendous dignity and a good lunch.",
    pages: 320,
    chapters: 8,
    status: "want",
    added_by: "monkey",
    added_at: "2026-08-20T10:00:00Z",
    notes: [{ who: "monkey", ch: PRELUDE, quote: "If we want things to stay as they are, things will have to change.", body: "Required reading for understanding my entire family.", at: "2026-08-20T10:05:00Z" }],
  },
  {
    title: "My Name Is Aram",
    author: "William Saroyan",
    year: 1940,
    description: "Stories of a boy growing up among his Armenian family in Fresno: a cousin who steals a white horse every morning, uncles with grand ideas, and summers that never quite end.",
    pages: 220,
    chapters: 14,
    status: "want",
    added_by: "cat",
    added_at: "2026-08-24T18:30:00Z",
    notes: [{ who: "cat", ch: PRELUDE, body: "Next, please. You'll recognise every single uncle.", at: "2026-08-24T18:31:00Z", marks: [["monkey", "heart"]] }],
  },
  {
    title: "Invisible Cities",
    author: "Italo Calvino",
    translator: "William Weaver",
    year: 1972,
    isbn: "9780156453806",
    description: "Marco Polo describes to Kublai Khan the cities of his empire, one after another, each impossible, each perhaps the same city.",
    pages: 165,
    chapters: 9,
    status: "want",
    added_by: "cat",
    added_at: "2026-09-05T12:00:00Z",
  },
];

const pool = db();
const force = process.argv.includes("--force");
const { rows } = await pool.query<{ n: number }>("select count(*)::int as n from books");
if (rows[0].n > 0 && !force) {
  console.log(`The archive already holds ${rows[0].n} books. Use --force to wipe it and re-seed.`);
  await pool.end();
  process.exit(0);
}

const client = await pool.connect();
try {
  await client.query("begin");
  await client.query("truncate books, covers, readings, reading_events, thoughts, marks, seals restart identity cascade");
  for (const b of BOOKS) {
    const { rows } = await client.query<{ id: number }>(
      `insert into books (title, author, translator, year_published, description, isbn, total_pages, total_chapters, status,
         started_on, finished_on, goal_chapter, goal_date, added_by, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) returning id`,
      [b.title, b.author, b.translator ?? null, b.year ?? null, b.description, b.isbn ?? null, b.pages, b.chapters, b.status,
        b.started ?? null, b.finished ?? null, b.goal?.[0] ?? null, b.goal?.[1] ?? null, b.added_by, b.added_at],
    );
    const id = rows[0].id;
    for (const [who, r] of Object.entries(b.readings ?? {})) {
      await client.query(
        `insert into readings (book_id, member, chapter, page, started_on, finished_on, rating, notes) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, who, r.chapter, r.page ?? null, r.started ?? null, r.finished ?? null, r.rating ?? null, r.notes ?? null],
      );
    }
    for (const [who, kind, ch, at] of b.events ?? []) {
      await client.query(`insert into reading_events (book_id, member, kind, chapter, created_at) values ($1,$2,$3,$4,$5)`, [id, who, kind, ch, at]);
    }
    for (const [who, ch, at] of b.seals ?? []) {
      await client.query(`insert into seals (book_id, member, chapter, broken_at) values ($1,$2,$3,$4)`, [id, who, ch, at]);
    }
    for (const n of b.notes ?? []) {
      const t = await client.query<{ id: number }>(
        `insert into thoughts (book_id, member, chapter, body, quote, page, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$7) returning id`,
        [id, n.who, n.ch, n.body, n.quote ?? null, n.page ?? null, n.at],
      );
      for (const [who, mark] of n.marks ?? []) {
        await client.query(`insert into marks (thought_id, member, mark) values ($1,$2,$3)`, [t.rows[0].id, who, mark]);
      }
      for (const r of n.replies ?? []) {
        await client.query(
          `insert into thoughts (book_id, member, chapter, body, reply_to, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$6)`,
          [id, r.who, n.ch, r.body, t.rows[0].id, r.at],
        );
      }
    }
  }
  await client.query("commit");
  console.log(`Seeded ${BOOKS.length} books.`);
} catch (err) {
  await client.query("rollback");
  throw err;
} finally {
  client.release();
  await pool.end();
}
