// stores/threadStore.ts — Enterprise Communication Platform
// SRP: manages thread list state. Persisted to localStorage with defensive merge.
//
// 2026-07-11: Created for comms-gated tenant UI rollout.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThreadData } from '@/services/threads.service';

interface ThreadState {
  threads: ThreadData[];
  activeThreadId: string | null;
  unreadCount: number;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  setThreads: (threads: ThreadData[]) => void;
  addThread: (thread: ThreadData) => void;
  updateThread: (id: string, patch: Partial<ThreadData>) => void;
  removeThread: (id: string) => void;
  setActiveThread: (id: string | null) => void;
  setUnreadCount: (count: number) => void;
  decrementUnread: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useThreadStore = create<ThreadState>()(
  persist(
    (set) => ({
      threads: [],
      activeThreadId: null,
      unreadCount: 0,
      loading: false,
      error: null,
      lastFetchedAt: null,

      setThreads: (threads) =>
        set({
          threads: Array.isArray(threads)
            ? threads.filter((t): t is ThreadData => t !== null && t !== undefined && t.id !== undefined)
            : [],
          lastFetchedAt: Date.now(),
          loading: false,
          error: null,
        }),

      addThread: (thread) =>
        set((s) => ({
          threads: [thread, ...s.threads].filter((t): t is ThreadData => t !== null && t !== undefined && t.id !== undefined),
        })),

      updateThread: (id, patch) =>
        set((s) => ({
          threads: s.threads.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removeThread: (id) =>
        set((s) => ({
          threads: s.threads.filter((t) => t.id !== id),
          activeThreadId: s.activeThreadId === id ? null : s.activeThreadId,
        })),

      setActiveThread: (id) => set({ activeThreadId: id }),

      setUnreadCount: (count) =>
        set({ unreadCount: typeof count === 'number' && count >= 0 ? count : 0 }),

      decrementUnread: () =>
        set((s) => ({
          unreadCount: Math.max(0, s.unreadCount - 1),
        })),

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error, loading: false }),
      reset: () =>
        set({
          threads: [],
          activeThreadId: null,
          unreadCount: 0,
          loading: false,
          error: null,
          lastFetchedAt: null,
        }),
    }),
    {
      name: 'thread-store',
      partialize: (state) => ({
        threads: state.threads.slice(0, 50),
        activeThreadId: state.activeThreadId,
        unreadCount: state.unreadCount,
      }),
      merge: (persistedState, currentState) => {
        const ps = (persistedState ?? {}) as { state?: Partial<ThreadState>; version?: number };
        const state = ps?.state;
        if (!state) return currentState;
        return {
          ...currentState,
          ...state,
          threads: Array.isArray(state.threads)
            ? state.threads.filter((t): t is ThreadData => t !== null && t !== undefined && t.id !== undefined)
            : currentState.threads,
          unreadCount:
            typeof state.unreadCount === 'number' && state.unreadCount >= 0
              ? state.unreadCount
              : currentState.unreadCount,
          activeThreadId:
            typeof state.activeThreadId === 'string' || state.activeThreadId === null
              ? state.activeThreadId
              : currentState.activeThreadId,
        };
      },
    },
  ),
);
