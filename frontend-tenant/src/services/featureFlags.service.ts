// services/featureFlags.service.ts — server-side feature flag reader.
//
// Calls the backend `/api/v1/feature-flags` endpoints added for H9 (Phase Hermes).
// Tenant-side users see their own effective flags via `/feature-flags/me`.
// Admins (in the admin UI) read & write any tenant's overrides via
// `/feature-flags/tenants/:id`.
//
// Values are cached in-memory with a short TTL. Mutations via
// `setTenantFlag` invalidate the cache.

import api from './api';

const FLAG_TTL_MS = 30_000;

let cache: FeatureFlagSnapshot | null = null;
let inflight: Promise<FeatureFlagSnapshot | null> | null = null;

export interface FeatureFlagSnapshot {
  fetchedAt: number;
  effective: Record<string, boolean>;
  overrides: Record<string, boolean>;
}

function emptySnapshot(): FeatureFlagSnapshot {
  return { fetchedAt: Date.now(), effective: {}, overrides: {} };
}

export async function fetchMyFeatureFlags(
  opts: { force?: boolean } = {},
): Promise<FeatureFlagSnapshot> {
  const cached: FeatureFlagSnapshot | null = cache;
  if (!opts.force && cached) {
    if (Date.now() - cached.fetchedAt < FLAG_TTL_MS) return cached;
  }
  const pending: Promise<FeatureFlagSnapshot | null> | null = inflight;
  if (pending) return pending as Promise<FeatureFlagSnapshot>;

  inflight = api
    .get('/feature-flags/me')
    .then((res) => {
      const data = (res.data?.data ?? res.data) as Partial<FeatureFlagSnapshot>;
      cache = {
        fetchedAt: Date.now(),
        effective: data.effective ?? {},
        overrides: data.overrides ?? {},
      };
      return cache;
    })
    .catch(() => {
      cache = emptySnapshot();
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return (await inflight) ?? emptySnapshot();
}

export async function setMyFlag(
  name: string,
  value: boolean,
): Promise<Record<string, boolean>> {
  const next = { ...(cache?.overrides ?? {}), [name]: value };
  const res = await api.patch('/feature-flags/me', { featureFlags: next });
  // Optimistic cache update; the server will return the canonical map.
  if (cache) {
    cache = {
      ...cache,
      overrides: (res.data?.data?.overrides ?? next) as Record<string, boolean>,
      effective: {
        ...cache.effective,
        [name]: value,
      },
    };
  }
  return cache?.overrides ?? next;
}

export function invalidateFeatureFlagCache(): void {
  cache = null;
}