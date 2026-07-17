// ─── hooks/useTenantAuth.ts ────────────────────────────────────────────────────
// Per user-roles.md: Frontend Tenant (hq.neurecore.com) allows ALL authenticated
// roles: SUPER_ADMIN, PLATFORM_ADMIN, SECURITY_OFFICER, SUPPORT, OWNER, ADMIN, USER, AUDITOR
//   - Waits for store hydration.
//   - Returns AuthUser for any authenticated user.
//   - Redirects to /login if no user after hydration.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import type { AuthUser } from '@/types/auth.types';

// Per user-roles.md: All roles may access Frontend Tenant
const TENANT_ROLES = [
  'SUPER_ADMIN', 'PLATFORM_ADMIN', 'SECURITY_OFFICER', 'SUPPORT',
  'OWNER', 'ADMIN', 'USER', 'AUDITOR'
];

export function useTenantAuth(): AuthUser | null {
  const { state } = useAuth();
  const router = useRouter();
  const user = state.status === 'authenticated' ? state.user : null;

  useEffect(() => {
    if (state.status === 'initializing') return;
    if (!user || !TENANT_ROLES.includes(user.role)) {
      router.replace('/login');
    }
  }, [state.status, user, router]);

  if (state.status === 'initializing') return null;
  return user && TENANT_ROLES.includes(user.role) ? user : null;
}
