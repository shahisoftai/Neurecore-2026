// ─── impl/AuthRouteRegistry.ts ───────────────────────────────────────────────
// SRP: Knows which routes don't require auth.

import type { IAuthRouteRegistry } from '../core/interfaces';

const UNAUTHENTICATED_ROUTE_PATTERNS = [
  /^\/login$/,
  /^\/forgot-password$/,
];

export class AuthRouteRegistry implements IAuthRouteRegistry {
  isUnauthenticatedRoute(pathname: string): boolean {
    return UNAUTHENTICATED_ROUTE_PATTERNS.some((re) => re.test(pathname));
  }

  getLoginUrl(): string {
    return '/login';
  }

  getPostAuthUrl(): string {
    return '/overview';
  }
}
