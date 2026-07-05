// services/auth-redirect.service.ts — Shared post-auth redirect logic.
// Used by both /login and /register to ensure new + existing users land on
// the right place. The rule:
//   - If user has no tenant OR tenant.onboardingCompletedAt is null
//     → /onboarding/setup
//   - Else → /home (Phase 5.5 stub ships 2026-07-04 — see app/home/page.tsx)
//
// Network failures on the tenant lookup fall through to /home so the user is
// never stuck on the post-auth screen. /command-center remains reachable as a
// legacy landing for direct links but is no longer the default destination.

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import api from './api';

export async function routeAfterAuth(router: AppRouterInstance): Promise<void> {
  try {
    const res = await api.get('/tenants/me/current');
    const tenant = (res.data?.data ?? res.data) as
      | { onboardingCompletedAt?: string | null }
      | null;
    if (tenant && !tenant.onboardingCompletedAt) {
      router.push('/onboarding/setup');
      return;
    }
  } catch {
    // Tenant lookup failed (no tenant, 403, network) — fall through.
  }
  router.push('/home');
}