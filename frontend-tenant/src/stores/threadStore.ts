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
          threads: Array.isArray(threads) ? threads : [],
          lastFetchedAt: Date.now(),
          loading: false,
          error: null,
        }),

      addThread: (thread) =>
        set((s) => ({
          threads: [thread, ...s.threads],
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
        const ps = (persistedState ?? {}) as Partial<ThreadState>;
        return {
          ...currentState,
          ...ps,
          threads: Array.isArray(ps.threads) ? ps.threads : currentState.threads,
          unreadCount:
            typeof ps.unreadCount === 'number' && ps.unreadCount >= 0
              ? ps.unreadCount
              : currentState.unreadCount,
          activeThreadId:
            typeof ps.activeThreadId === 'string' || ps.activeThreadId === null
              ? ps.activeThreadId
              : currentState.activeThreadId,
        };
      },
    },
  ),
);
