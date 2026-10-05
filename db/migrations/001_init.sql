-- Jarvis: private PDF library.
-- Documents own pages (full cleaned text per physical page) and chunks
-- (retrieval units with embeddings + full-text vectors). Everything hangs off
-- documents.id so future features (notes, highlights, bookmarks, summaries,
-- reading progress) can reference a document, a page, or a chunk.

create extension if not exists vector;
create extension if not exists pgcrypto;

create table documents (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  author         text,
  description    text,
  tags           text[] not null default '{}',
  -- once the user edits title/author, re-processing must not overwrite them
  metadata_edited boolean not null default false,

  file_name      text not null,
  file_type      text not null default 'pdf',
  file_size      bigint not null,
  sha256         text not null unique,
  page_count     integer,

  -- queued -> processing -> ready | needs_ocr | failed
  status         text not null default 'queued'
                 check (status in ('queued', 'processing', 'ready', 'needs_ocr', 'failed')),
  status_detail  text,
  -- 0..1 progress within the current processing stage
  progress       real not null default 0,
  stage          text,

  has_cover      boolean not null default false,
  text_pages     integer,          -- pages with an extractable text layer
  chunk_count    integer,
  outline        jsonb not null default '[]',   -- [{title, page, level}]
  outline_source text,                          -- pdf | headings | none
  pdf_info       jsonb not null default '{}',
  embedding_model text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  processed_at   timestamptz
);

create index documents_created_at_idx on documents (created_at desc);
create index documents_tags_idx on documents using gin (tags);

create table pages (
  document_id uuid not null references documents (id) on delete cascade,
  page        integer not null,        -- 1-based physical page
  label       text,                    -- printed page label, if the PDF defines one
  text        text not null,
  char_count  integer not null,
  primary key (document_id, page)
);

create table chunks (
  id          bigserial primary key,
  document_id uuid not null references documents (id) on delete cascade,
  ordinal     integer not null,
  page_start  integer not null,
  page_end    integer not null,
  chapter     text,
  text        text not null,
  word_count  integer not null,
  embedding   vector({{EMBEDDING_DIMENSIONS}}) not null,
  tsv         tsvector generated always as (to_tsvector('english', text)) stored,
  unique (document_id, ordinal)
);

create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_tsv_idx on chunks using gin (tsv);
create index chunks_document_idx on chunks (document_id, page_start);

-- Background work queue (claimed with FOR UPDATE SKIP LOCKED by the worker).
create table jobs (
  id          bigserial primary key,
  document_id uuid references documents (id) on delete cascade,
  kind        text not null,            -- ingest
  status      text not null default 'pending'
              check (status in ('pending', 'running', 'done', 'failed')),
  attempts    integer not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  finished_at timestamptz
);

create index jobs_pending_idx on jobs (created_at) where status = 'pending';
