import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { config } from "./config";

/**
 * Object storage for original PDFs and derived assets (covers).
 * Local filesystem for now; the interface is small enough to back with S3 or
 * any object store later without touching callers.
 */
export interface ObjectStore {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Buffer>;
  stream(key: string, range?: { start: number; end: number }): Readable;
  size(key: string): Promise<number | null>;
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

  stream(key: string, range?: { start: number; end: number }) {
    return createReadStream(this.resolve(key), range);
  }

  async size(key: string) {
    try {
      return (await stat(this.resolve(key))).size;
    } catch {
      return null;
    }
  }

  async removePrefix(prefix: string) {
    await rm(this.resolve(prefix), { recursive: true, force: true });
  }
}

export const storage: ObjectStore = new LocalStore(config.storageDir);

export const keys = {
  original: (documentId: string) => `documents/${documentId}/original.pdf`,
  cover: (documentId: string) => `documents/${documentId}/cover.jpg`,
  documentPrefix: (documentId: string) => `documents/${documentId}`,
};
