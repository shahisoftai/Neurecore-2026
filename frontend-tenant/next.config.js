/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ── Compression & minification ─────────────────────────────────────────────
  compress: true,
  poweredByHeader: false,

  // ── Font & image optimisation ──────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // ── Bundle optimisation (tree-shake heavy libraries) ──────────────────────
  experimental: {
    optimizePackageImports: ["framer-motion", "zustand"],
  },

  // ── Security headers ───────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin" },
          { key: "Permissions-Policy", value: "microphone=self" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self' http://localhost:* ws://localhost:* https://brain.neurecore.com https://*.neurecore.com https://*.upstash.io",
              "frame-src https://accounts.google.com",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // ── Phase 2 — Route rewrites for backward-compatible migration ────────────
  //
  // Old flat routes are mapped to new canonical URLs so tenants never see
  // intentional 404s. After 30 days of zero direct traffic (tracked via
  // observability), old routes are removed in a later minor release.
  //
  // See memory-bank/new_neurecore.md §4.1 for full migration plan.
  async rewrites() {
    return [
      // Command center
      { source: "/dashboard", destination: "/command-center" },

      // Marketplace (covers agent listing + connector config)
      { source: "/agents", destination: "/marketplace?tab=agents" },
      { source: "/agents/new", destination: "/marketplace?tab=spawn" },
      { source: "/connectors", destination: "/marketplace?tab=connectors" },

      // Departments roster + org chart
      { source: "/departments", destination: "/departments" }, // canonical
      { source: "/org-chart", destination: "/departments?tab=org" },

      // Per-dept workspace redirects (Phase 5 ships these; placeholder for now)
      // Tenant sees first dept's workspace if /tasks etc. hit without context.
      { source: "/tasks", destination: "/departments?tab=tasks" },
      { source: "/workflows", destination: "/departments?tab=workflows" },
      { source: "/projects", destination: "/departments?tab=projects" },
      { source: "/goals", destination: "/departments?tab=goals" },
      { source: "/routines", destination: "/departments?tab=routines" },

      // Finance hub
      { source: "/costs", destination: "/finance?tab=overview" },
      { source: "/billing", destination: "/finance?tab=billing" },

      // Service desk
      { source: "/inbox", destination: "/service-desk?tab=inbox" },
      { source: "/approvals", destination: "/service-desk?tab=approvals" },
      { source: "/activity", destination: "/service-desk?tab=activity" },

      // Intelligence
      { source: "/analytics", destination: "/intelligence?tab=analytics" },
      { source: "/settings", destination: "/intelligence?tab=settings" },

      // Strategy page deleted
      { source: "/strategy", destination: "/command-center" },
    ];
  },
};

module.exports = nextConfig;
