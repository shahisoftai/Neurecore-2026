// ─── hooks/useTenantAuth.ts (DEPRECATED shim over useAuth) ───────────────────
// Behavioural contract preserved:
//   - Waits for store hydration.
//   - Returns AuthUser when role is in TENANT_ROLES.
//   - Redirects to /login if no user / wrong role after hydration.
// But the redirect is now driven by useAuth().state, not by a separate effect.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import type { AuthUser } from '@/types/auth.types';

const TENANT_ROLES = ['OWNER', 'ADMIN', 'USER', 'AUDITOR'];

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
