// ─── components/AuthProvider.tsx ─────────────────────────────────────────────
// Mounts the AuthService (initialize() fires exactly once). Children render
// immediately; useAuth() handles 'initializing' via discriminated state.

'use client';

import { useEffect } from 'react';
import { authService } from '../di/authContainer';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void authService.initialize();
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined' || typeof window === 'undefined') return;
    const channel = new BroadcastChannel('neurecore-auth');
    channel.onmessage = (event) => {
      if (event.data?.type === 'SESSION_KILLED') {
        void authService.initialize();
      }
    };
    return () => channel.close();
  }, []);

  return <>{children}</>;
}
