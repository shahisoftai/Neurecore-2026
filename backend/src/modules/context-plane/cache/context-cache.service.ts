/**
 * ContextCache — bounded, authorization-aware in-memory cache (ADR-002 §11).
 *
 * Cache keys include tenant + actor + AUTHORIZATION DECISION + capability +
 * scope. A response is NEVER reused across actors with different authorization
 * decisions: we cache the ALREADY-AUTHORIZED provider result keyed by the
 * decision, so unauthorized reuse is impossible (we never cache unredacted data
 * and apply auth afterward).
 *
 * Bounded (LRU by insertion + TTL). Invalidation is tenant + capability scoped.
 *
 * Stats are tenant-scoped: each get/set/invalidate mutates counters for that
 * tenantId plus a global counter. stats() returns both so the admin endpoint
 * can filter to the caller's tenant without leaking other tenants' telemetry.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { CapabilityContext } from '../contracts/context-plane.interface';

interface Entry {
  value: CapabilityContext;
  expiresAt: number;
  tenantId: string;
  capability: string;
}

interface TenantStats {
  hits: number;
  misses: number;
  invalidations: number;
  size: number;
}

const DEFAULT_TTL_MS = 30_000;
const MAX_ENTRIES = 5000;

@Injectable()
export class ContextCache {
  private readonly logger = new Logger(ContextCache.name);
  private readonly store = new Map<string, Entry>();

  hits = 0;
  misses = 0;
  invalidations = 0;
  private readonly byTenant = new Map<string, TenantStats>();

  /**
   * Build an authorization-aware cache key. The authorization access decision
   * and effective authority are part of the key so two actors with different
   * decisions can never collide.
   */
  key(params: {
    tenantId: string;
    actorId: string;
    capability: string;
    access: string;
    effectiveAuthority: number;
    scope: Record<string, unknown>;
  }): string {
    const scopeKey = JSON.stringify(
      Object.keys(params.scope)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (params.scope as Record<string, unknown>)[k];
          return acc;
        }, {}),
    );
    return [
      params.tenantId,
      params.actorId,
      params.capability,
      params.access,
      params.effectiveAuthority,
      scopeKey,
    ].join('|');
  }

  get(key: string, maxAgeMs?: number): CapabilityContext | null {
    const entry = this.store.get(key);
    const tenantId = this.tenantFromKey(key);
    if (!entry) {
      this.misses++;
      this.bumpTenant(tenantId, 'misses', 1);
      return null;
    }
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      this.bumpTenant(entry.tenantId, 'misses', 1);
      return null;
    }
    if (maxAgeMs != null) {
      const age = now - (entry.expiresAt - DEFAULT_TTL_MS);
      if (age > maxAgeMs) {
        this.misses++;
        this.bumpTenant(entry.tenantId, 'misses', 1);
        return null;
      }
    }
    this.hits++;
    this.bumpTenant(entry.tenantId, 'hits', 1);
    // Return a CACHED-marked copy.
    return { ...entry.value, cacheStatus: 'CACHED' };
  }

  /**
   * Best-effort tenantId extraction from a cache key. The key format
   * established by `key()` is `${tenantId}|${actorId}|${capability}|...` so the
   * tenantId is always the first segment. Returns empty string for malformed
   * keys (no counter bump then — those keys should never exist in production).
   */
  private tenantFromKey(key: string): string {
    const idx = key.indexOf('|');
    return idx > 0 ? key.slice(0, idx) : '';
  }

  set(key: string, value: CapabilityContext, ttlMs = DEFAULT_TTL_MS): void {
    if (this.store.size >= MAX_ENTRIES) {
      // Evict oldest insertion.
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      tenantId: value.tenantId,
      capability: value.capability,
    });
  }

  /** Invalidate entries for a tenant, optionally restricted to a capability. */
  invalidate(tenantId: string, capability?: string): number {
    let n = 0;
    for (const [k, entry] of this.store.entries()) {
      if (entry.tenantId !== tenantId) continue;
      if (capability && entry.capability !== capability) continue;
      this.store.delete(k);
      n++;
    }
    this.invalidations += n;
    this.bumpTenant(tenantId, 'invalidations', n);
    if (n > 0) {
      this.logger.debug(
        `Invalidated ${n} context cache entries (tenant=${tenantId}${
          capability ? `, capability=${capability}` : ''
        })`,
      );
    }
    return n;
  }

  /**
   * Stats. Returns both a global aggregate (size + counters) and a per-tenant
   * breakdown so admin controllers can filter to the caller's tenant without
   * leaking telemetry about other tenants.
   *
   * size is reported on per-tenant as well (count of entries currently in the
   * store whose tenantId == T) so the caller's view reflects their footprint
   * without observing others.
   */
  stats() {
    const byTenant: Record<string, TenantStats> = {};
    const sizeByTenant = new Map<string, number>();
    for (const entry of this.store.values()) {
      sizeByTenant.set(entry.tenantId, (sizeByTenant.get(entry.tenantId) ?? 0) + 1);
    }
    for (const [tenantId, agg] of this.byTenant.entries()) {
      byTenant[tenantId] = {
        hits: agg.hits,
        misses: agg.misses,
        invalidations: agg.invalidations,
        size: sizeByTenant.get(tenantId) ?? 0,
      };
    }
    // Also include tenants that have entries but no recorded activity yet.
    for (const [tenantId, size] of sizeByTenant.entries()) {
      if (!byTenant[tenantId]) {
        byTenant[tenantId] = { hits: 0, misses: 0, invalidations: 0, size };
      }
    }
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      invalidations: this.invalidations,
      byTenant,
    };
  }

  /** Mutate a counter for the given tenant; create the bucket on first use. */
  private bumpTenant(tenantId: string, field: 'hits' | 'misses' | 'invalidations', by: number): void {
    if (!tenantId) return;
    let agg = this.byTenant.get(tenantId);
    if (!agg) {
      agg = { hits: 0, misses: 0, invalidations: 0, size: 0 };
      this.byTenant.set(tenantId, agg);
    }
    agg[field] += by;
  }
}
