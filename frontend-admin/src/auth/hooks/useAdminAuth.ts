// ─── hooks/useAdminAuth.ts (DEPRECATED shim over useAuth) ────────────────────
// Behavioural contract preserved:
//   - Waits for store hydration.
//   - Returns AuthUser when role is in ADMIN_ROLES.
//   - Redirects to /login if no user / wrong role after hydration.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import type { AuthUser } from '@/types/auth.types';

const ADMIN_ROLES = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SECURITY_OFFICER', 'SUPPORT'];

export function useAdminAuth(): AuthUser | null {
  const { state } = useAuth();
  const router = useRouter();
  const user = state.status === 'authenticated' ? state.user : null;

  useEffect(() => {
    if (state.status === 'initializing') return;
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      router.replace('/login');
    }
  }, [state.status, user, router]);

  if (state.status === 'initializing') return null;
  return user && ADMIN_ROLES.includes(user.role) ? user : null;
}
