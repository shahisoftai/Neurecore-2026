// ─── components/AuthProvider.tsx ─────────────────────────────────────────────
// Mounts the AuthService (initialize() fires exactly once). Children render
// immediately; useAuth() handles 'initializing' via discriminated state.
//
// Rationale: gating the whole tree behind a splash caused page hangs when
// persist hydration raced useEffect. The current plan lets useAuth() return
// { status: 'initializing' } from useSyncExternalStore, which pages and
// hooks can handle natively (e.g. useRequireAuth shows the splash UI
// itself instead of wrapping in a portal).

'use client';

import { useEffect } from 'react';
import { authService } from '../di/authContainer';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void authService.initialize();
  }, []);

  // Cross-tab BroadcastChannel sync.
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
