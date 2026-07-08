// ─── impl/ZustandUserRepository.ts ────────────────────────────────────────────
// SRP: Single owner of the Zustand auth store.
// DIP: Implements IUserRepository from the core.
// Invariant: isAuthenticated = user !== null (derived, not persisted).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IUserRepository } from '../core/interfaces';
import type { AuthUser } from '@/types/auth.types';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
  setHasHydrated: (v: boolean) => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearUser: () => set({ user: null, isAuthenticated: false }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      merge: (persistedState, currentState) => {
        const ps = (persistedState ?? {}) as Partial<AuthState>;
        // isAuthenticated MUST be derived from user, never trusted from disk
        // (otherwise a hostile localStorage can claim isAuthenticated=true with
        // user=null, which would route a page past its auth gate).
        const safeUser = ps.user && typeof ps.user === 'object' ? ps.user : null;
        return {
          ...currentState,
          ...ps,
          user: safeUser,
          isAuthenticated: !!safeUser,
          _hasHydrated: currentState._hasHydrated,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export class ZustandUserRepository implements IUserRepository {
  getUser(): AuthUser | null {
    return useAuthStore.getState().user;
  }

  setUser(user: AuthUser): void {
    useAuthStore.getState().setUser(user);
  }

  clearUser(): void {
    useAuthStore.getState().clearUser();
  }

  hasHydrated(): boolean {
    return useAuthStore.getState()._hasHydrated;
  }

  onHydrationComplete(listener: () => void): () => void {
    // If the store already hydrated (rehydration happens only once across the
    // app's lifetime), fire the listener immediately so callers don't hang.
    if (useAuthStore.persist.hasHydrated()) {
      // Use queueMicrotask to defer until after current micro-task — keeps
      // semantics identical to "hydration just completed".
      queueMicrotask(() => listener());
      return () => undefined;
    }
    return useAuthStore.persist.onFinishHydration(() => listener());
  }

  /** Used only by tests to seed state. */
  _forceHydrated(): void {
    useAuthStore.getState().setHasHydrated(true);
  }

  /** Re-exported so backwards-compat shims (AppInitializer, login pages, etc.) can subscribe. */
  static get store() {
    return useAuthStore;
  }
}

export { useAuthStore };
