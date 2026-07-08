// ─── hooks/useAuth.ts ────────────────────────────────────────────────────────
// L1: the only hook pages should import for auth.
// Uses useSyncExternalStore for concurrent-render-safe subscriptions.

'use client';

import { useSyncExternalStore } from 'react';
import { authService } from '../di/authContainer';
import type { IAuthService, AuthState } from '../core/interfaces';

const subscribe = (cb: () => void) => authService.subscribe(() => cb());
const getSnapshot = (): AuthState => authService.getState();
const getServerSnapshot = (): AuthState => ({ status: 'initializing' });

export function useAuth(): {
  state: AuthState;
  login: IAuthService['login'];
  loginWithGoogle: IAuthService['loginWithGoogle'];
  register: IAuthService['register'];
  logout: IAuthService['logout'];
  refetch: IAuthService['refetch'];
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    state,
    login: authService.login.bind(authService),
    loginWithGoogle: authService.loginWithGoogle.bind(authService),
    register: authService.register.bind(authService),
    logout: authService.logout.bind(authService),
    refetch: authService.refetch.bind(authService),
  };
}
