'use client';

// hooks/useOnboardingChecklist.ts — Read-only hook for components that just
// need the current state. Mutations should go through the store directly so
// callers can use the same hook for both.
//
// IMPORTANT: this hook subscribes to the stable `entries` array only and
// derives `pending` / `visiblePending` / `progress` via useMemo. Subscribing
// to a selector that returns a new array/object on every call would cause an
// infinite render loop ("getSnapshot should be cached").

import { useEffect, useMemo } from 'react';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import type { ChecklistEntryView } from '@/lib/wizard/types';

export function useOnboardingChecklist() {
  const entries = useOnboardingChecklistStore((s) => s.entries);
  const isHydrated = useOnboardingChecklistStore((s) => s.isHydrated);
  const isLoading = useOnboardingChecklistStore((s) => s.isLoading);
  const lastError = useOnboardingChecklistStore((s) => s.lastError);
  const globalDismissed = useOnboardingChecklistStore((s) => s.globalDismissed);
  const hydrate = useOnboardingChecklistStore((s) => s.hydrate);

  useEffect(() => {
    if (!isHydrated && !isLoading) {
      void hydrate();
    }
  }, [isHydrated, isLoading, hydrate]);

  const pending = useMemo<ChecklistEntryView[]>(
    () => entries.filter((e) => e.state === 'PENDING'),
    [entries],
  );

  const visiblePending = useMemo<ChecklistEntryView[]>(
    () =>
      entries.filter(
        (e) =>
          e.state === 'PENDING' &&
          e.missionFeedItem &&
          !e.missionFeedItem.dismissedAt,
      ),
    [entries],
  );

  const progress = useMemo(() => {
    const total = entries.length;
    const done = entries.filter((e) => e.state === 'DONE').length;
    return {
      total,
      done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }, [entries]);

  return {
    entries,
    pending,
    visiblePending,
    progress,
    isHydrated,
    isLoading,
    lastError,
    globalDismissed,
    hydrate,
  };
}