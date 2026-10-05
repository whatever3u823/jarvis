import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { config } from "./config";

/**
 * Object storage for original PDFs and derived assets (covers): the local
 * disk, or Vercel Blob (private) on a hosted deployment.
 */
export interface StoredObject {
  body: ReadableStream<Uint8Array>;
  /** Total size of the object in bytes. */
  size: number;
  /** The byte range returned, when a range was requested and honoured. */
  range: { start: number; end: number } | null;
}

export interface ObjectStore {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  open(key: string, range?: { start: number; end: number | null }): Promise<StoredObject | null>;
  removePrefix(prefix: string): Promise<void>;
}

class LocalStore implements ObjectStore {
  constructor(private root: string) {}

  private resolve(key: string): string {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error(`Invalid storage key: ${key}`);
    return p;
  }

  async put(key: string, data: Uint8Array) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  get(key: string) {
    return readFile(this.resolve(key));
  }

  async open(key: string, range?: { start: number; end: number | null }): Promise<StoredObject | null> {
    const p = this.resolve(key);
    let size: number;
    try {
      size = (await stat(p)).size;
    } catch {
      return null;
    }
    const r = range ? { start: range.start, end: Math.min(range.end ?? size - 1, size - 1) } : null;
    const node = createReadStream(p, r ?? undefined);
    return { body: Readable.toWeb(node) as ReadableStream<Uint8Array>, size, range: r };
  }

  async removePrefix(prefix: string) {
    await rm(this.resolve(prefix), { recursive: true, force: true });
  }
}

/** Vercel Blob, private access (served only through this app). Needs BLOB_READ_WRITE_TOKEN. */
class BlobStore implements ObjectStore {
  private sdk = import("@vercel/blob");

  async put(key: string, data: Uint8Array, contentType: string) {
    const { put } = await this.sdk;
    await put(key, Buffer.from(data), { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
  }

  async get(key: string): Promise<Buffer> {
    const { get } = await this.sdk;
    const res = await get(key, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) throw new Error(`Blob not found: ${key}`);
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  }

  async open(key: string, range?: { start: number; end: number | null }): Promise<StoredObject | null> {
    const { get } = await this.sdk;
    const res = await get(key, {
      access: "private",
      headers: range ? { range: `bytes=${range.start}-${range.end ?? ""}` } : undefined,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const cr = res.headers.get("content-range")?.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (cr) return { body: res.stream, size: Number(cr[3]), range: { start: Number(cr[1]), end: Number(cr[2]) } };
    return { body: res.stream, size: res.blob.size, range: null };
  }

  async removePrefix(prefix: string) {
    const { list, del } = await this.sdk;
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: prefix.endsWith("/") ? prefix : prefix + "/", cursor });
      if (page.blobs.length) await del(page.blobs.map((b) => b.url));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }
}

export const storage: ObjectStore = config.storage === "blob" ? new BlobStore() : new LocalStore(config.storageDir);

export const keys = {
  original: (documentId: string) => `documents/${documentId}/original.pdf`,
  cover: (documentId: string) => `documents/${documentId}/cover.jpg`,
  documentPrefix: (documentId: string) => `documents/${documentId}`,
  /** Where the browser uploads a PDF before it is registered (Vercel Blob only). */
  incoming: (uploadId: string) => `incoming/${uploadId}.pdf`,
};
