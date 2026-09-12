import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * The fundamentals dataset is read from disk at request time, so it has to be
   * traced into the serverless bundle. Without this it exists in the repo,
   * builds fine, and then reads as ENOENT in production — a failure that looks
   * exactly like "no data" and is very hard to tell apart from it.
   */
  outputFileTracingIncludes: {
    "/stock/**": ["./data/**"],
    "/api/**": ["./data/**"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
