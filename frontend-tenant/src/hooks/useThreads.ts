// hooks/useThreads.ts — Enterprise Communication Platform
// SRP: data fetching + WS subscription lifecycle for threads.
// DIP: depends on IThreadService interface, not concrete threadService.
//
// 2026-07-11: Created for comms-gated tenant UI rollout.

'use client';

import { useCallback, useEffect } from 'react';
import { useThreadStore } from '@/stores/threadStore';
import {
  threadService,
  type IThreadService,
  type CreateThreadParams,
  type ThreadMessage,
} from '@/services/threads.service';
import { getSocket, connectSocket, joinThread, leaveThread } from '@/services/socket';

let fetchInFlight: Promise<void> | null = null;

export function useThreads(deps?: { threadService?: IThreadService }) {
  const svc = deps?.threadService ?? threadService;

  const threads = useThreadStore((s) => s.threads);
  const activeThreadId = useThreadStore((s) => s.activeThreadId);
  const unreadCount = useThreadStore((s) => s.unreadCount);
  const loading = useThreadStore((s) => s.loading);
  const error = useThreadStore((s) => s.error);
  const lastFetchedAt = useThreadStore((s) => s.lastFetchedAt);

  const fetchThreads = useCallback(async () => {
    if (fetchInFlight) {
      await fetchInFlight;
      return;
    }
    fetchInFlight = (async () => {
      useThreadStore.getState().setLoading(true);
      try {
        const [list, count] = await Promise.all([
          svc.list(),
          svc.getUnreadCount(),
        ]);
        useThreadStore.getState().setThreads(list);
        useThreadStore.getState().setUnreadCount(count);
      } catch (err) {
        useThreadStore.getState().setError(
          err instanceof Error ? err.message : 'Failed to load threads',
        );
      }
    })();
    await fetchInFlight;
    fetchInFlight = null;
  }, [svc]);

  // Initial fetch
  useEffect(() => {
    if (lastFetchedAt === null) {
      void fetchThreads();
    }
  }, [fetchThreads, lastFetchedAt]);

  // WS lifecycle: subscribe to active thread's room
  useEffect(() => {
    const socket = getSocket();
    connectSocket();

    if (activeThreadId) {
      joinThread(activeThreadId);
    }

    return () => {
      if (activeThreadId) {
        leaveThread(activeThreadId);
      }
    };
  }, [activeThreadId]);

  const createThread = useCallback(
    async (params: CreateThreadParams) => {
      const thread = await svc.create(params);
      useThreadStore.getState().addThread(thread);
      return thread;
    },
    [svc],
  );

  const getMessages = useCallback(
    async (
      threadId: string,
      opts?: { limit?: number; before?: string },
    ): Promise<ThreadMessage[]> => {
      return svc.getMessages(threadId, opts);
    },
    [svc],
  );

  const markRead = useCallback(
    async (threadId: string) => {
      await svc.markRead(threadId);
      useThreadStore.getState().decrementUnread();
    },
    [svc],
  );

  const closeThread = useCallback(
    async (threadId: string) => {
      await svc.close(threadId);
      useThreadStore.getState().removeThread(threadId);
    },
    [svc],
  );

  const selectThread = useCallback((id: string | null) => {
    useThreadStore.getState().setActiveThread(id);
  }, []);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  return {
    threads,
    activeThread,
    activeThreadId,
    unreadCount,
    loading,
    error,
    fetchThreads,
    selectThread,
    createThread,
    getMessages,
    markRead,
    closeThread,
  };
}
