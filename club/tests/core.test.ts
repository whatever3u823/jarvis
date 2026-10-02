import { test } from "node:test";
import assert from "node:assert/strict";
import { AFTERWORD, PRELUDE, chapterLabel, fractionRead, isValidSection, roman, sections } from "../src/lib/chapters";
import { horizon, isSealed, redact } from "../src/lib/spoilers";
import { whenSaid, daysBetween, archivalDate } from "../src/lib/format";
import { bookSchema, thoughtSchema } from "../src/lib/validation";
import { threads } from "../src/lib/threads";
import type { Readings, Thought } from "../src/lib/data/types";

test("roman numerals", () => {
  assert.equal(roman(1), "I");
  assert.equal(roman(14), "XIV");
  assert.equal(roman(33), "XXXIII");
  assert.equal(roman(2026), "MMXXVI");
});

test("sections run prelude, chapters, afterword", () => {
  assert.deepEqual(sections(3), [PRELUDE, 1, 2, 3, AFTERWORD]);
  assert.equal(chapterLabel(PRELUDE), "Prelude");
  assert.equal(chapterLabel(AFTERWORD), "Afterword");
  assert.ok(isValidSection(3, 3));
  assert.ok(!isValidSection(4, 3));
  assert.ok(isValidSection(AFTERWORD, 3));
});

test("fraction read prefers pages, then chapters", () => {
  const book = { total_pages: 200, total_chapters: 10 };
  assert.equal(fractionRead({ chapter: 5, page: 50, finished: false }, book), 0.25);
  assert.equal(fractionRead({ chapter: 5, page: null, finished: false }, book), 0.4);
  assert.equal(fractionRead({ chapter: 0, page: null, finished: false }, book), 0);
  assert.equal(fractionRead({ chapter: 3, page: null, finished: true }, book), 1);
});

test("spoiler rule", () => {
  const none = new Set<number>();
  const h = horizon({ chapter: 8, finished: false });
  assert.ok(!isSealed({ member: "cat", chapter: 8 }, "monkey", h, none), "current chapter is open");
  assert.ok(isSealed({ member: "cat", chapter: 9 }, "monkey", h, none), "beyond the ribbon is sealed");
  assert.ok(!isSealed({ member: "monkey", chapter: 20 }, "monkey", h, none), "your own notes never are");
  assert.ok(!isSealed({ member: "cat", chapter: 9 }, "monkey", h, new Set([9])), "a broken seal stays broken");
  assert.ok(isSealed({ member: "cat", chapter: AFTERWORD }, "monkey", h, none), "afterword sealed until finished");
  assert.ok(!isSealed({ member: "cat", chapter: AFTERWORD }, "monkey", horizon({ chapter: 10, finished: true }), none));
  assert.ok(!isSealed({ member: "cat", chapter: PRELUDE }, "monkey", horizon(null), none), "prelude always open");
  assert.ok(isSealed({ member: "cat", chapter: 1 }, "monkey", horizon(null), none), "not begun: chapter I is sealed");
});

test("redaction strips sealed text before it leaves the server", () => {
  const t = (id: number, member: "monkey" | "cat", chapter: number): Thought => ({
    id, book_id: 1, member, chapter, body: `secret ${id}`, quote: "a quote", page: 3, reply_to: null, created_at: new Date(2026, 0, id), marks: [],
  });
  const readings = new Map<number, Readings>([[1, {
    monkey: { book_id: 1, member: "monkey", chapter: 2, page: null, started_on: null, finished_on: null, rating: null, notes: null, updated_at: new Date() },
    cat: null,
  }]]);
  const notes = redact([t(1, "cat", 1), t(2, "cat", 5), t(3, "monkey", 9)], "monkey", readings, new Map());
  assert.equal(notes[0].sealed, false);
  assert.equal(notes[1].sealed, true);
  assert.ok(!("body" in notes[1]) && !("quote" in notes[1]), "sealed notes carry no text");
  assert.equal(notes[2].sealed, false);
  assert.ok(!JSON.stringify(notes).includes("secret 2"));
});

test("threads nest replies under their note", () => {
  const base = { book_id: 1, chapter: 1, quote: null, page: null, marks: [] };
  const list = threads([
    { ...base, id: 1, member: "cat", body: "a", reply_to: null, created_at: new Date(1), sealed: false },
    { ...base, id: 2, member: "monkey", body: "b", reply_to: 1, created_at: new Date(2), sealed: false },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].replies.length, 1);
});

test("time is said the way people say it", () => {
  const now = new Date("2026-10-02T18:00:00Z"); // 20:00 in Rome
  assert.equal(whenSaid(new Date("2026-10-02T17:59:30Z"), now), "just now");
  assert.equal(whenSaid(new Date("2026-10-02T07:00:00Z"), now), "this morning");
  assert.equal(whenSaid(new Date("2026-10-01T21:30:00Z"), now), "yesterday, late at night");
  assert.equal(daysBetween("2025-11-16", "2025-12-20"), 34);
  assert.equal(archivalDate("2025-11-14"), "14.XI.2025");
});

test("book and note validation", () => {
  assert.equal(bookSchema.safeParse({ title: "", author: "x" }).success, false);
  const ok = bookSchema.parse({ title: "Pnin", author: "Nabokov", total_pages: "191", isbn: "978-0-679-72341-0", cover_url: "" });
  assert.equal(ok.total_pages, 191);
  assert.equal(ok.isbn, "9780679723410");
  assert.equal(ok.cover_url, null);
  assert.equal(bookSchema.safeParse({ title: "a", author: "b", started_on: "2026-02-02", finished_on: "2026-01-01" }).success, false);
  assert.equal(thoughtSchema.safeParse({ book_id: "1", chapter: "3", body: "   " }).success, false);
});
