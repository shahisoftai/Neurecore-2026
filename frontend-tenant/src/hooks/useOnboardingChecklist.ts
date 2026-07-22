'use client';

// hooks/useOnboardingChecklist.ts — Read-only hook for components that just
// need the current state. Mutations should go through the store directly so
// callers can use the same hook for both.
//
// Derives pending, visiblePending, progress (weighted), phase groupings,
// and dependency-aware unlocked items.

import { useEffect, useMemo } from 'react';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import type { ChecklistEntryView, WizardPhase } from '@/lib/wizard/types';
import { WIZARD_PHASES } from '@/lib/wizard/types';

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

  /** Weighted progress: each item contributes its weight value. */
  const progress = useMemo(() => {
    const totalWeight = entries.reduce(
      (sum, e) => sum + (e.config.weight ?? 1),
      0,
    );
    const doneWeight = entries
      .filter((e) => e.state === 'DONE')
      .reduce((sum, e) => sum + (e.config.weight ?? 1), 0);
    return {
      total: entries.length,
      done: entries.filter((e) => e.state === 'DONE').length,
      totalWeight,
      doneWeight,
      percent: totalWeight === 0 ? 0 : Math.round((doneWeight / totalWeight) * 100),
    };
  }, [entries]);

  /** Entries grouped by phase, ordered by phase number. */
  const byPhase = useMemo(() => {
    const map = new Map<WizardPhase, ChecklistEntryView[]>();
    for (const phase of WIZARD_PHASES) {
      map.set(phase, []);
    }
    for (const e of entries) {
      const phase = e.config.phase ?? 0;
      const list = map.get(phase);
      if (list) list.push(e);
    }
    return map;
  }, [entries]);

  /** Progress per phase. */
  const phaseProgress = useMemo(() => {
    const result: Record<WizardPhase, { total: number; done: number; percent: number; totalWeight: number; doneWeight: number }> = {} as Record<WizardPhase, { total: number; done: number; percent: number; totalWeight: number; doneWeight: number }>;
    for (const [phase, phaseEntries] of byPhase.entries()) {
      const totalWeight = phaseEntries.reduce((s, e) => s + (e.config.weight ?? 1), 0);
      const doneWeight = phaseEntries
        .filter((e) => e.state === 'DONE')
        .reduce((s, e) => s + (e.config.weight ?? 1), 0);
      result[phase] = {
        total: phaseEntries.length,
        done: phaseEntries.filter((e) => e.state === 'DONE').length,
        totalWeight,
        doneWeight,
        percent: totalWeight === 0 ? 0 : Math.round((doneWeight / totalWeight) * 100),
      };
    }
    return result;
  }, [byPhase]);

  /** Returns slugs that are in DONE state (for dependency checks). Uses string set for compatibility with dependsOn. */
  const doneSlugs = useMemo(
    () => new Set<string>(entries.filter((e) => e.state === 'DONE').map((e) => e.slug)),
    [entries],
  );

  /** Next recommended item: first visible pending whose dependencies are met. */
  const nextRecommended = useMemo<ChecklistEntryView | null>(() => {
    for (const phase of WIZARD_PHASES) {
      const phaseEntries = byPhase.get(phase) ?? [];
      for (const e of phaseEntries) {
        if (e.state !== 'PENDING') continue;
        if (e.missionFeedItem?.dismissedAt) continue;
        const deps = e.config.dependsOn ?? [];
        const allMet = deps.every((d) => doneSlugs.has(d));
        if (allMet) return e;
      }
    }
    return null;
  }, [byPhase, doneSlugs]);

  return {
    entries,
    pending,
    visiblePending,
    progress,
    phaseProgress,
    byPhase,
    nextRecommended,
    doneSlugs,
    isHydrated,
    isLoading,
    lastError,
    globalDismissed,
    hydrate,
  };
}
