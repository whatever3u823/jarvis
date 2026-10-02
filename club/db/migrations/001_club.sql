-- The club's archive. Members are identified by a stable key ('monkey', 'cat')
-- defined in src/club.config.ts; names and personalities live there, not here.

create table books (
  id              serial primary key,          -- doubles as the accession number
  title           text not null,
  author          text not null,
  translator      text,
  year_published  integer,
  description     text,
  isbn            text,
  cover_url       text,
  total_pages     integer check (total_pages > 0),
  total_chapters  integer check (total_chapters > 0 and total_chapters < 1000),
  status          text not null default 'want'
                  check (status in ('want', 'reading', 'finished', 'abandoned')),
  started_on      date,
  finished_on     date,
  goal_chapter    integer,
  goal_date       date,
  added_by        text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index books_status_idx on books (status);

-- Uploaded cover images (small; kept in the database so deployment needs no object store).
create table covers (
  book_id     integer primary key references books (id) on delete cascade,
  mime        text not null,
  data        bytea not null,
  updated_at  timestamptz not null default now()
);

-- One row per member per book: where each of us is, and what each of us thought.
create table readings (
  book_id      integer not null references books (id) on delete cascade,
  member       text not null,
  chapter      integer not null default 0,     -- chapter currently being read; 0 = not begun
  page         integer,
  started_on   date,
  finished_on  date,
  rating       smallint check (rating between 1 and 5),
  notes        text,
  updated_at   timestamptz not null default now(),
  primary key (book_id, member)
);

-- The reading timeline: progress, beginnings, endings, broken seals.
create table reading_events (
  id          serial primary key,
  book_id     integer not null references books (id) on delete cascade,
  member      text not null,
  kind        text not null check (kind in ('began', 'progress', 'finished', 'seal')),
  chapter     integer,
  page        integer,
  created_at  timestamptz not null default now()
);
create index reading_events_book_idx on reading_events (book_id, created_at desc);

-- Marginalia. chapter: 0 = prelude (before reading), 1..n = chapters, 9999 = afterword.
create table thoughts (
  id          serial primary key,
  book_id     integer not null references books (id) on delete cascade,
  member      text not null,
  chapter     integer not null,
  body        text not null,
  quote       text,
  page        integer,
  reply_to    integer references thoughts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index thoughts_book_idx on thoughts (book_id, chapter, created_at);
create index thoughts_recent_idx on thoughts (created_at desc);

-- Marks left beside a note: ☞ (this one), NB, !, ?, ♡.
create table marks (
  thought_id  integer not null references thoughts (id) on delete cascade,
  member      text not null,
  mark        text not null check (mark in ('manicule', 'nb', 'bang', 'query', 'heart')),
  created_at  timestamptz not null default now(),
  primary key (thought_id, member, mark)
);

-- Deliberately opened spoiler seals: one per member, book and chapter.
create table seals (
  book_id    integer not null references books (id) on delete cascade,
  member     text not null,
  chapter    integer not null,
  broken_at  timestamptz not null default now(),
  primary key (book_id, member, chapter)
);
