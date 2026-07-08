// ─── hooks/useRequireAuth.ts ─────────────────────────────────────────────────
// Convenience: useAuth + auto-redirect for pages that MUST be authenticated.

'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './useAuth';

export function useRequireAuth() {
  const { state } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status !== 'unauthenticated' && state.status !== 'error') return;
    const from = encodeURIComponent(pathname || '/');
    router.replace(`/login?from=${from}`);
  }, [state.status, router, pathname]);

  return state;
}
