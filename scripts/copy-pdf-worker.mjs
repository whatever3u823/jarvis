// Copies the pdf.js worker into /public so the in-browser reader can load it
// from the same origin (no CDN, works offline).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

// The legacy build includes polyfills for browsers without the newest JS APIs.
const src = "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs";
if (existsSync(src)) {
  mkdirSync("public", { recursive: true });
  copyFileSync(src, "public/pdf.worker.min.mjs");
}
