import type { NextConfig } from "next";

// `output: "standalone"` is for self-hosted deploys (VPS/Docker — see docs/DEPLOYMENT.md).
// On Vercel it is unnecessary and can interfere with the platform build, so it is
// disabled automatically when building inside the Vercel environment.
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // Type errors FAIL the build (audit A-04): a type error is always a defect;
  // `ignoreBuildErrors: true` shipped broken builds silently. `bunx tsc --noEmit`
  // is clean, so this gate is safe to enable.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Deliberately NO X-Frame-Options/frame-ancestors deny: the sandbox
          // preview panel embeds the app in a cross-site iframe. Revisit if the
          // app is ever deployed standalone (then set frame-ancestors 'self').
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
