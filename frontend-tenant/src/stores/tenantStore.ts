'use client';

/**
 * TenantStore — single source of truth for tenant-scoped UI metadata.
 *
 * Part 9 N3 — replaces the IconRail's local `tenantIndustryGroup` state +
 * per-component `tenantsService.getCurrent()` fetch. Multiple components
 * (IconRail, TopBar, RailCustomizeModal, PlanImpactPanel, TierChangeModal,
 * future widgets) all need the same tenant metadata. Each one previously
 * fetched it independently, leading to:
 *   - N duplicate network round-trips on first page paint.
 *   - Stale local state when one component fetched first and another
 *     rendered the rail with a still-empty industryGroup.
 *
 * DRY: this store is the only place that calls `tenantsService.getCurrent()`
 * for non-mutation reads. Mutations (PATCH tenant) still go through the
 * service directly — this store just caches the GET response.
 *
 * SRP: this store owns tenant UI metadata caching only. It does NOT:
 *   - Decide when to fetch (the `fetchTenant()` action does that on demand)
 *   - Invalidate the cache (TTL-based via `lastFetchedAt`)
 *   - Sync with server-side changes (a 30s TTL is good enough for the
 *     rail/badge rendering — not for billing-sensitive flows which always
 *     re-fetch)
 *
 * DIP: the consumer-facing selector `useTenantIndustryGroup()` hides the
 * store implementation, so future swaps to SWR / React Query / Context
 * API are a one-file change.
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import { tenantsService } from '@/services/tenants.service';

interface TenantState {
  /** The tenant's industry group slug (e.g. 'financial-compliance'). null while loading or if no industry set. */
  industryGroup: string | null;
  /** The tenant's industry slug (e.g. 'accounting-audit-services'). null while loading. */
  industry: string | null;
  /** When we last fetched (epoch ms). Used for TTL-based staleness checks. */
  lastFetchedAt: number | null;
  /** True while a fetch is in flight. */
  loading: boolean;
  /** Error from the most recent fetch. null on success. */
  error: string | null;

  /** Idempotent fetch — refreshes if TTL has expired. Safe to call from many components. */
  fetchTenant: () => Promise<void>;
  /** Force a fresh fetch (bypasses TTL). Used after PATCH /tenants/me. */
  refreshTenant: () => Promise<void>;
  /** Reset to initial state. Used on sign-out. */
  reset: () => void;
}

/** 30s — short enough that the rail reflects a recent tenant industry change without a hard refresh. */
const STALE_AFTER_MS = 30_000;

export const useTenantStore = create<TenantState>((set, get) => ({
  industryGroup: null,
  industry: null,
  lastFetchedAt: null,
  loading: false,
  error: null,

  async fetchTenant() {
    const { lastFetchedAt, loading } = get();
    // Re-entrancy guard: only one in-flight fetch at a time.
    if (loading) return;
    // TTL guard: if the cached data is fresh, skip the network call.
    if (lastFetchedAt && Date.now() - lastFetchedAt < STALE_AFTER_MS) return;
    await get().refreshTenant();
  },

  async refreshTenant() {
    set({ loading: true, error: null });
    try {
      const t = await tenantsService.getCurrent();
      set({
        industryGroup: t.industryGroup ?? null,
        industry: t.industry ?? null,
        lastFetchedAt: Date.now(),
        loading: false,
        error: null,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load tenant',
      });
    }
  },

  reset() {
    set({
      industryGroup: null,
      industry: null,
      lastFetchedAt: null,
      loading: false,
      error: null,
    });
  },
}));

/**
 * Convenience hook — fires `fetchTenant()` once on mount + exposes the
 * cached tenant metadata to consumers.
 *
 * Use this from the layout shell (TenantShell or equivalent) so all
 * children that need `industryGroup` get a cached value without N
 * network round-trips.
 *
 * IMPORTANT: this hook only fires ONE fetch even if many components call
 * it (because the store's `fetchTenant()` is idempotent and has a TTL
 * guard). After mount, consumers re-read the cached state via Zustand's
 * selector mechanism — so adding a 100th consumer doesn't add 100
 * fetches.
 */
export function useTenantIndustryGroup(): {
  industryGroup: string | null;
  industry: string | null;
  loading: boolean;
} {
  const industryGroup = useTenantStore((s) => s.industryGroup);
  const industry = useTenantStore((s) => s.industry);
  const loading = useTenantStore((s) => s.loading);
  const fetchTenant = useTenantStore((s) => s.fetchTenant);

  useEffect(() => {
    void fetchTenant();
    // fetchTenant is stable (Zustand action reference) — effect runs once.
  }, [fetchTenant]);

  return { industryGroup, industry, loading };
}
