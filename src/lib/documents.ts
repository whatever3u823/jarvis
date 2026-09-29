import { createHash } from "node:crypto";
import path from "node:path";
import { db } from "./db";
import { enqueueJob } from "./ingest/jobs";
import { keys, storage } from "./storage";

export type DocumentStatus = "queued" | "processing" | "ready" | "needs_ocr" | "failed";

export interface OutlineItem {
  title: string;
  page: number;
  level: number;
}

export interface DocumentRecord {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  tags: string[];
  fileName: string;
  fileType: string;
  fileSize: number;
  pageCount: number | null;
  status: DocumentStatus;
  statusDetail: string | null;
  stage: string | null;
  progress: number;
  hasCover: boolean;
  textPages: number | null;
  chunkCount: number | null;
  outline: OutlineItem[];
  outlineSource: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}

const COLUMNS = `
  id, title, author, description, tags, file_name, file_type, file_size, page_count,
  status, status_detail, stage, progress, has_cover, text_pages, chunk_count,
  outline, outline_source, created_at, updated_at, processed_at`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecord(r: any): DocumentRecord {
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    description: r.description,
    tags: r.tags ?? [],
    fileName: r.file_name,
    fileType: r.file_type,
    fileSize: Number(r.file_size),
    pageCount: r.page_count,
    status: r.status,
    statusDetail: r.status_detail,
    stage: r.stage,
    progress: r.progress,
    hasCover: r.has_cover,
    textPages: r.text_pages,
    chunkCount: r.chunk_count,
    outline: r.outline ?? [],
    outlineSource: r.outline_source,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    processedAt: r.processed_at ? new Date(r.processed_at).toISOString() : null,
  };
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const { rows } = await db().query(`select ${COLUMNS} from documents order by created_at desc`);
  return rows.map(toRecord);
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db().query(`select ${COLUMNS} from documents where id = $1`, [id]);
  return rows[0] ? toRecord(rows[0]) : null;
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/** "Meditations by Marcus Aurelius.pdf" -> { title, author } */
export function metadataFromFileName(fileName: string): { title: string; author: string | null } {
  const base = path
    .basename(fileName, path.extname(fileName))
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const by = base.match(/^(.+?)\s+by\s+(.+)$/i);
  if (by) return { title: by[1].trim(), author: by[2].trim() };
  const pretty = /[a-z]-[a-z]/.test(base) && !base.includes(" ") ? base.replace(/-/g, " ") : base;
  return { title: pretty.charAt(0).toUpperCase() + pretty.slice(1), author: null };
}

export interface CreateResult {
  document: DocumentRecord;
  duplicate: boolean;
}

/** Store an uploaded PDF, register it, and queue it for ingestion. */
export async function createDocumentFromUpload(fileName: string, bytes: Uint8Array): Promise<CreateResult> {
  if (bytes.length < 5 || Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") {
    throw new UploadError(`"${fileName}" is not a PDF file.`);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = await db().query(`select ${COLUMNS} from documents where sha256 = $1`, [sha256]);
  if (existing.rows[0]) return { document: toRecord(existing.rows[0]), duplicate: true };

  const { title, author } = metadataFromFileName(fileName);
  const { rows } = await db().query(
    `insert into documents (title, author, file_name, file_size, sha256, stage)
     values ($1, $2, $3, $4, $5, 'queued') returning ${COLUMNS}`,
    [title, author, fileName, bytes.length, sha256],
  );
  const doc = toRecord(rows[0]);
  try {
    await storage.put(keys.original(doc.id), bytes);
  } catch (err) {
    await db().query("delete from documents where id = $1", [doc.id]);
    throw err;
  }
  await enqueueJob(doc.id, "ingest");
  return { document: doc, duplicate: false };
}

export class UploadError extends Error {}

export interface DocumentPatch {
  title?: string;
  author?: string | null;
  description?: string | null;
  tags?: string[];
}

export async function updateDocument(id: string, patch: DocumentPatch): Promise<DocumentRecord | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const add = (col: string, v: unknown) => {
    values.push(v);
    sets.push(`${col} = $${values.length}`);
  };
  if (patch.title !== undefined) add("title", patch.title.trim() || "Untitled");
  if (patch.author !== undefined) add("author", patch.author?.trim() || null);
  if (patch.description !== undefined) add("description", patch.description?.trim() || null);
  if (patch.tags !== undefined)
    add("tags", [...new Set(patch.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))]);
  if (patch.title !== undefined || patch.author !== undefined) sets.push("metadata_edited = true");
  if (sets.length === 0) return getDocument(id);
  values.push(id);
  const { rows } = await db().query(
    `update documents set ${sets.join(", ")}, updated_at = now() where id = $${values.length} returning ${COLUMNS}`,
    values,
  );
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const { rowCount } = await db().query("delete from documents where id = $1", [id]);
  await storage.removePrefix(keys.documentPrefix(id));
  return (rowCount ?? 0) > 0;
}

export async function reprocessDocument(id: string): Promise<void> {
  await db().query(
    `update documents set status = 'queued', stage = 'queued', progress = 0, status_detail = null, updated_at = now() where id = $1`,
    [id],
  );
  await enqueueJob(id, "ingest");
}

export interface PageText {
  page: number;
  label: string | null;
  text: string;
}

export async function getPages(documentId: string, from: number, to: number): Promise<PageText[]> {
  const { rows } = await db().query(
    `select page, label, text from pages where document_id = $1 and page between $2 and $3 order by page`,
    [documentId, from, to],
  );
  return rows;
}

export async function allTags(): Promise<string[]> {
  const { rows } = await db().query(`select distinct unnest(tags) as tag from documents order by tag`);
  return rows.map((r) => r.tag);
}
