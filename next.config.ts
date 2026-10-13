import type { NextConfig } from "next";

// `output: "standalone"` is for self-hosted deploys (VPS/Docker — see docs/DEPLOYMENT.md).
// On Vercel it is unnecessary and can interfere with the platform build, so it is
// disabled automatically when building inside the Vercel environment.
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
