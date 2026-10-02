import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // This app lives inside the Jarvis repository but is its own project.
  turbopack: { root: here },
  outputFileTracingRoot: here,
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  experimental: {
    // Uploaded covers travel through a Server Action.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
