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
      name: 'admin-auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
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
    if (useAuthStore.persist.hasHydrated()) {
      queueMicrotask(() => listener());
      return () => undefined;
    }
    return useAuthStore.persist.onFinishHydration(() => listener());
  }

  /** Used only by tests to seed state. */
  _forceHydrated(): void {
    useAuthStore.getState().setHasHydrated(true);
  }

  static get store() {
    return useAuthStore;
  }
}

export { useAuthStore };
