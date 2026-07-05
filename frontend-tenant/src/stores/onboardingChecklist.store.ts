// stores/onboardingChecklist.store.ts — Single source of truth for the
// progressive onboarding wizard system. Components subscribe to this; they
// never call axios directly.
//
// Hydration: trigger via `useOnboardingChecklist().hydrate()` from a top-level
// effect (TenantShell or page mount). The store stays empty until hydrated,
// so consumers should handle `entries.length === 0` gracefully.
//
// Optimistic updates: complete/dismiss actions update state immediately and
// roll back on error. Network failure is logged but never crashes the UI.

import { create } from 'zustand';
import { checklistService } from '@/services/checklist.service';
import type {
  ChecklistEntryView,
  ChecklistListResponse,
  WizardSlug,
} from '@/lib/wizard/types';

interface OnboardingChecklistState {
  entries: ChecklistEntryView[];
  isHydrated: boolean;
  isLoading: boolean;
  lastError: string | null;
  /** Globally hidden by user. Null = follow default rules. */
  globalDismissed: boolean;

  hydrate: () => Promise<void>;
  complete: (slug: WizardSlug) => Promise<void>;
  skip: (slug: WizardSlug, reason?: string) => Promise<void>;
  dismiss: (slug: WizardSlug, reason?: string) => Promise<void>;
  dismissAll: (dismissed: boolean) => Promise<void>;
  reset: () => void;
}

export const useOnboardingChecklistStore = create<OnboardingChecklistState>()(
  (set, get) => ({
    entries: [],
    isHydrated: false,
    isLoading: false,
    lastError: null,
    globalDismissed: false,

    async hydrate() {
      if (get().isHydrated || get().isLoading) return;
      set({ isLoading: true, lastError: null });
      try {
        const res: ChecklistListResponse = await checklistService.list();
        set({
          entries: res.entries,
          isHydrated: true,
          isLoading: false,
        });
      } catch (err) {
        // Network/permission failure: keep hydrated=false but expose the error
        // so consumers can show a "couldn't load checklist" message.
        set({
          isLoading: false,
          lastError: err instanceof Error ? err.message : 'Failed to load checklist',
        });
      }
    },

    async complete(slug) {
      const previous = get().entries;
      // Optimistic: mark DONE, hide mission feed projection
      set({
        entries: previous.map((e) =>
          e.slug === slug
            ? {
                ...e,
                state: 'DONE',
                completedAt: new Date().toISOString(),
                missionFeedItem: e.missionFeedItem
                  ? { ...e.missionFeedItem, dismissedAt: new Date().toISOString() }
                  : null,
              }
            : e,
        ),
      });
      try {
        await checklistService.complete(slug);
      } catch (err) {
        set({ entries: previous, lastError: err instanceof Error ? err.message : 'Complete failed' });
      }
    },

    async skip(slug, reason) {
      const previous = get().entries;
      set({
        entries: previous.map((e) =>
          e.slug === slug
            ? {
                ...e,
                state: 'SKIPPED',
                skippedAt: new Date().toISOString(),
                missionFeedItem: e.missionFeedItem
                  ? { ...e.missionFeedItem, dismissedAt: new Date().toISOString() }
                  : null,
              }
            : e,
        ),
      });
      try {
        await checklistService.skip(slug, reason);
      } catch (err) {
        set({ entries: previous, lastError: err instanceof Error ? err.message : 'Skip failed' });
      }
    },

    async dismiss(slug, reason) {
      const previous = get().entries;
      set({
        entries: previous.map((e) =>
          e.slug === slug && e.missionFeedItem
            ? {
                ...e,
                missionFeedItem: {
                  ...e.missionFeedItem,
                  dismissedAt: new Date().toISOString(),
                },
              }
            : e,
        ),
      });
      try {
        await checklistService.dismiss(slug, reason);
      } catch (err) {
        set({ entries: previous, lastError: err instanceof Error ? err.message : 'Dismiss failed' });
      }
    },

    async dismissAll(dismissed) {
      set({ globalDismissed: dismissed });
      try {
        await checklistService.dismissAll(dismissed);
      } catch (err) {
        set({
          globalDismissed: !dismissed,
          lastError: err instanceof Error ? err.message : 'Dismiss-all failed',
        });
      }
    },

    reset() {
      set({
        entries: [],
        isHydrated: false,
        isLoading: false,
        lastError: null,
        globalDismissed: false,
      });
    },
  }),
);

// ─── Convenience selectors (DIP: components depend on these, not on the raw store) ───
//
// IMPORTANT: Zustand uses `Object.is` to compare selector results. Selectors
// that return NEW arrays/objects on every call will cause an infinite render
// loop ("The result of getSnapshot should be cached"). Consumers should
// subscribe to `entries` (stable reference until mutation) and compute
// derived values inline with `useMemo` — see `useOnboardingChecklist.ts`.

export { };