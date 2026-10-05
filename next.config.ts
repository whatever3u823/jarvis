import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / heavy server-side modules are loaded from node_modules at runtime
  // rather than bundled.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "pdfjs-dist", "@napi-rs/canvas", "sharp", "pg"],
  poweredByHeader: false,
  // Files read at runtime that static tracing can't see (serverless deployments).
  outputFileTracingIncludes: {
    "/**": [
      "./db/migrations/**/*",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/pdfjs-dist/cmaps/**/*",
    ],
  },
  // The local embedding runtime (~300 MB) can't run in a serverless function and
  // would exceed its size limit; hosted deployments use Voyage AI instead.
  outputFileTracingExcludes: {
    "/**": [
      "./node_modules/onnxruntime-node/**/*",
      "./node_modules/onnxruntime-web/**/*",
      "./node_modules/onnxruntime-common/**/*",
      "./node_modules/@huggingface/**/*",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
      "./models/**/*",
      "./data/**/*",
    ],
  },
};

export default nextConfig;
