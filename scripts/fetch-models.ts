/**
 * Download the local embedding model (BAAI bge-base-en-v1.5, ONNX) into
 * MODELS_DIR in the layout transformers.js expects:
 *
 *   models/bge-base-en-v1.5/{config.json, tokenizer.json, tokenizer_config.json,
 *                            special_tokens_map.json, onnx/model.onnx}
 *
 * Tries Hugging Face first, then the Qdrant fastembed mirror on Google Cloud
 * Storage (same weights, ONNX-optimised). Run once: `npm run models:fetch`.
 */
import "./env";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { gunzipSync } from "node:zlib";
import { config } from "../src/lib/config";

const MODEL = config.embeddingModel;
const SOURCES: Record<string, { hf: string; mirror: string }> = {
  "bge-base-en-v1.5": {
    hf: "https://huggingface.co/Xenova/bge-base-en-v1.5/resolve/main",
    mirror: "https://storage.googleapis.com/qdrant-fastembed/fast-bge-base-en-v1.5.tar.gz",
  },
};
const FILES = ["config.json", "tokenizer.json", "tokenizer_config.json"];
const OPTIONAL_FILES = ["special_tokens_map.json"];

const dir = path.join(config.modelsDir, MODEL);

async function download(url: string, dest: string) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  let seen = 0;
  let last = 0;
  const progress = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length;
      if (total && Date.now() - last > 1000) {
        last = Date.now();
        process.stdout.write(`\r  ${path.basename(dest)} ${((seen / total) * 100).toFixed(0)}% of ${(total / 1e6).toFixed(0)} MB   `);
      }
      cb(null, chunk);
    },
  });
  await mkdir(path.dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), progress, createWriteStream(dest + ".part"));
  await rename(dest + ".part", dest);
  if (total) process.stdout.write(`\r  ${path.basename(dest)} done (${(total / 1e6).toFixed(0)} MB)        \n`);
}

async function fromHuggingFace(base: string) {
  for (const f of FILES) await download(`${base}/${f}`, path.join(dir, f));
  for (const f of OPTIONAL_FILES) await download(`${base}/${f}`, path.join(dir, f)).catch(() => {});
  await download(`${base}/onnx/model.onnx`, path.join(dir, "onnx", "model.onnx"));
}

/** Minimal tar reader: extracts regular files from a .tar.gz buffer. */
function untar(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let off = 0;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/s, "");
    const size = parseInt(header.subarray(124, 136).toString("utf8").replace(/\0.*$/s, "").trim() || "0", 8);
    const type = String.fromCharCode(header[156]);
    const full = prefix ? `${prefix}/${name}` : name;
    if (type === "0" || type === "\0") files.set(full, buf.subarray(off + 512, off + 512 + size));
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

async function fromMirror(url: string) {
  const tmp = path.join(config.modelsDir, `${MODEL}.tar.gz`);
  await download(url, tmp);
  const { readFile } = await import("node:fs/promises");
  // Some servers send the archive with Content-Encoding: gzip, which fetch already decodes.
  const raw = await readFile(tmp);
  const files = untar(raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw);
  const pick = (suffix: string) => [...files.entries()].find(([n]) => n.endsWith(suffix))?.[1];
  for (const f of [...FILES, ...OPTIONAL_FILES]) {
    const data = pick(`/${f}`);
    if (!data && FILES.includes(f)) throw new Error(`${f} missing from mirror archive`);
    if (data) await writeFile(path.join(dir, f), data);
  }
  const onnx = pick("model_optimized.onnx") ?? pick("model.onnx");
  if (!onnx) throw new Error("ONNX weights missing from mirror archive");
  await mkdir(path.join(dir, "onnx"), { recursive: true });
  await writeFile(path.join(dir, "onnx", "model.onnx"), onnx);
  await rm(tmp, { force: true });
}

const source = SOURCES[MODEL];
if (existsSync(path.join(dir, "onnx", "model.onnx"))) {
  console.log(`${MODEL} already present in ${dir}`);
} else if (!source) {
  console.error(`No download source configured for "${MODEL}". Place its files in ${dir} manually.`);
  process.exit(1);
} else {
  await mkdir(dir, { recursive: true });
  try {
    console.log(`Downloading ${MODEL} from Hugging Face…`);
    await fromHuggingFace(source.hf);
  } catch (err) {
    console.warn(`  Hugging Face download failed (${err instanceof Error ? err.message : err}); trying mirror…`);
    await rm(path.join(dir, "onnx"), { recursive: true, force: true });
    await fromMirror(source.mirror);
  }
  console.log(`Model ready in ${dir}`);
}

// Sanity check: load it and embed a sentence.
const { getEmbedder } = await import("../src/lib/embed");
const v = await getEmbedder().embedQuery("what is within our power");
if (v.length !== config.embeddingDimensions) throw new Error(`Expected ${config.embeddingDimensions} dimensions, got ${v.length}`);
console.log(`Embedding check passed (${v.length} dimensions).`);
