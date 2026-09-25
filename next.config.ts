import type { NextConfig } from "next";

const snapshotReview =
  process.env.NODE_ENV !== "production" && process.env.AGORA_REVIEW_MODE === "snapshot";

const nextConfig: NextConfig = {
  ...(["fixtures", "snapshot", "admin"].includes(process.env.AGORA_REVIEW_MODE || "") && process.env.NODE_ENV !== "production"
    ? { distDir: `.local-review/next-${process.env.AGORA_REVIEW_PORT || "3100"}` } : {}),
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    // The snapshot runner serves an explicit error before these routes can
    // enqueue work or mutate imported conversations. Production is unaffected.
    if (!snapshotReview) return [];
    const helperPort = Number(process.env.AGORA_REVIEW_PORT || 3400) + 1;
    return {
      beforeFiles: [
        "/api/agora/suggest",
        "/api/agora/submit",
        "/api/agora/:threadId/follow-up",
        "/api/agora/:threadId/recover",
      ].map((source) => ({
        source,
        destination: `http://127.0.0.1:${helperPort}/generation-disabled`,
      })),
    };
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
