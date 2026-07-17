// ─── hooks/useAdminAuth.ts ────────────────────────────────────────────────────
// Enforces SUPER_ADMIN-only access for admin portal per user-roles.md:
//   - Waits for store hydration.
//   - Returns AuthUser when role is SUPER_ADMIN.
//   - Redirects to /login if no user / wrong role after hydration.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import type { AuthUser } from '@/types/auth.types';

// Per user-roles.md: Only SUPER_ADMIN may access Frontend Admin (cc.neurecore.com)
const ADMIN_ROLES = ['SUPER_ADMIN'];

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
