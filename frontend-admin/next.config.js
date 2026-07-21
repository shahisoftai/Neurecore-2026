/** @type {import('next').NextConfig} */
const path = require("path");
const isProd = process.env.NODE_ENV === "production";

// Set outputFileTracingRoot to the repository root to avoid Next.js inferring
// the wrong workspace root when multiple lockfiles exist in parent folders.
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, ".."),
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // PERF-FIX: gzip admin pages and any response served via Next.js
  // (notably the rewrite proxy path which still exists as a fallback).
  compress: true,
  ...(isProd
    ? {
        // In production we serve the admin portal behind /admin.
        // In local dev we keep routes unprefixed (e.g. /login) for simplicity.
        basePath: "/admin",
        assetPrefix: "/admin",
      }
    : {}),
  // Same-origin API proxy (F1 + Batch 1 hardening).
  //
  // In production OLS proxies /api/* → NestJS directly, so browser API calls
  // never touch Next.js. The rewrites below are belt-and-suspenders:
  //   1. /api/v1/:path*  → works in local dev (no basePath, no OLS proxy)
  //   2. /admin/api/v1/:path* → backup in prod if OLS ever routes /api/* to
  //      Next.js instead of NestJS (with basePath every URL is under /admin).
  //
  // __Host- cookies are set by NestJS — they require Secure + no Domain,
  // both preserved when the browser sees same-origin cc.neurecore.com.
  async rewrites() {
    const backend = process.env.NEXT_INTERNAL_API_URL || 'http://127.0.0.1:3003';
    return [
      { source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` },
      { source: '/admin/api/v1/:path*', destination: `${backend}/api/v1/:path*` },
    ];
  },
};

module.exports = nextConfig;
