'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import type { AuthUser } from '@/types/auth.types';

const SUPER_ROLES = ['SUPER_ADMIN', 'PLATFORM_ADMIN'] as const;

export function useSuperAdmin(): AuthUser | null {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!user || !SUPER_ROLES.includes(user.role as never)) {
      router.replace('/login');
    }
  }, [user, router]);

  return user && SUPER_ROLES.includes(user.role as never) ? user : null;
}
