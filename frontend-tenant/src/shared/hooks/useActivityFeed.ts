'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket, connectSocket } from '@/services/socket';
import type { ActivityFeedEvent } from '@/services/activity-feed.service';
import { activityFeedService } from '@/services/activity-feed.service';

/**
 * useActivityFeed — Phase 5.
 *
 * Single source of truth for the unified activity feed:
 *   1. Initial REST load via `/api/v1/activity`.
 *   2. WebSocket subscription to `activity:new` (tenant-scoped fan-out
 *      from `EnterpriseEventBusService`).
 *   3. Backfill-on-reconnect: when the socket transitions back to
 *      connected, fetch any events newer than the most recent local id.
 *   4. Polling fallback: periodic refresh every 30s if socket events
 *      aren't being received (ensures feed stays updated even if WS fails).
 *
 * Returns the merged, time-sorted list (newest first).
 */
export function useActivityFeed(opts: { limit?: number; pollIntervalMs?: number } = {}) {
  const limit = opts.limit ?? 50;
  const pollIntervalMs = opts.pollIntervalMs ?? 30_000;
  const [events, setEvents] = useState<ActivityFeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const lastIdRef = useRef<string | null>(null);
  const wasConnectedRef = useRef<boolean>(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollTimeRef = useRef<Date | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await activityFeedService.list({ limit });
      setEvents(list);
      if (list[0]) lastIdRef.current = list[0].id;
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const pollForNewEvents = useCallback(async () => {
    if (!lastIdRef.current) return;
    try {
      const list = await activityFeedService.list({ limit, since: lastIdRef.current });
      if (list.length === 0) return;
      setEvents((prev) => {
        const known = new Set(prev.map((p) => p.id));
        const fresh = list.filter((e) => !known.has(e.id));
        if (fresh.length === 0) return prev;
        const merged = [...fresh, ...prev].slice(0, limit);
        lastIdRef.current = merged[0]?.id ?? lastIdRef.current;
        return merged;
      });
      lastPollTimeRef.current = new Date();
    } catch {
      // Silently fail polling - socket should handle real-time updates
    }
  }, [limit]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Socket connection and event handling
  useEffect(() => {
    const socket = getSocket();
    connectSocket();

    const handleNew = (event: ActivityFeedEvent) => {
      setEvents((prev) => {
        if (prev.some((p) => p.id === event.id)) return prev;
        const next = [event, ...prev].slice(0, limit);
        lastIdRef.current = next[0]?.id ?? lastIdRef.current;
        return next;
      });
    };

    const handleConnect = () => {
      if (wasConnectedRef.current && lastIdRef.current) {
        activityFeedService
          .list({ limit, since: lastIdRef.current ?? undefined })
          .then((list) => {
            if (list.length === 0) return;
            setEvents((prev) => {
              const known = new Set(prev.map((p) => p.id));
              const fresh = list.filter((e) => !known.has(e.id));
              if (fresh.length === 0) return prev;
              const merged = [...fresh, ...prev].slice(0, limit);
              lastIdRef.current = merged[0]?.id ?? lastIdRef.current;
              return merged;
            });
          })
          .catch(() => undefined);
      }
      wasConnectedRef.current = true;
    };

    socket.on('activity:new', handleNew);
    socket.on('connect', handleConnect);
    return () => {
      socket.off('activity:new', handleNew);
      socket.off('connect', handleConnect);
    };
  }, [limit]);

  // Polling fallback - ensures feed updates even if socket isn't receiving events
  useEffect(() => {
    pollTimerRef.current = setInterval(() => {
      void pollForNewEvents();
    }, pollIntervalMs);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [pollForNewEvents, pollIntervalMs]);

  return { events, loading, error, reload };
}