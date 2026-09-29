import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / heavy server-side modules are loaded from node_modules at runtime
  // rather than bundled.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "pdfjs-dist", "@napi-rs/canvas", "sharp", "pg"],
  poweredByHeader: false,
};

export default nextConfig;
