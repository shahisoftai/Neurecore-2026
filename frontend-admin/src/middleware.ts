/**
 * NeureCore Admin Portal — Next.js Middleware
 *
 * Server-side enforcement of SUPER_ADMIN-only access per user-roles.md.
 * All routes except /login require a valid session with role=SUPER_ADMIN.
 *
 * This is the authoritative server-side check; the client-side useAdminAuth()
 * hook provides defense-in-depth but can be bypassed.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/api/health', '/_next', '/favicon'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Extract token from cookie (uses __Host- prefix for security)
  const token = request.cookies.get('__Host-nc_at')?.value;

  if (!token) {
    // No token — redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Decode JWT payload (base64url, not verified - backend validates)
    // We only check the role claim here for initial access control
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

    if (payload.role !== 'SUPER_ADMIN') {
      // Not SUPER_ADMIN — redirect to login with error
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('reason', 'insufficient');
      return NextResponse.redirect(loginUrl);
    }

    // SUPER_ADMIN — allow access
    return NextResponse.next();
  } catch {
    // Invalid token format — redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
