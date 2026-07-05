// lib/url.ts — Resolves asset URLs against the API base URL.
//
// Why: backend returns asset paths as relative `/cdn/logos/...` because
// that's how static serving is mounted. In dev, the Next.js dev server
// doesn't proxy `/cdn/*` to the backend (only `/api/v1/*`), so relative
// URLs 404 in the browser. In production OLS handles it. This helper
// makes dev work the same as production by prepending `NEXT_PUBLIC_API_URL`.
//
// Rules:
//   - Already-absolute URLs (http://, https://, data:, blob:) → return as-is.
//   - Paths starting with `/cdn/` → prepend API origin.
//   - Anything else → return as-is (don't touch API calls or app routes).

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export function assetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path;
  }
  if (path.startsWith('/cdn/')) {
    // Strip `/api/v1` (or any trailing path) from API_URL to get origin.
    // API_URL examples:
    //   http://localhost:3000/api/v1     → origin = http://localhost:3000
    //   /api/v1                          → origin = '' (relative; dev)
    //   https://brain.neurecore.com/api/v1 → origin = https://brain.neurecore.com
    const origin = API_URL.replace(/\/api\/.*$/, '');
    return origin + path;
  }
  return path;
}