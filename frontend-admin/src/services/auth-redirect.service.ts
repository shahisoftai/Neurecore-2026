// Post-auth redirect for admin users. Allowed roles are validated by the
// login page before calling this — the redirect target is deterministic.
//
// Kept as a service (not inline in the page) so both /login and any future
// admin registration / invitation flow share the same code path.

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export function routeAfterAdminAuth(router: AppRouterInstance): void {
  router.push('/overview');
}
