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
 */

import { Injectable, Logger } from '@nestjs/common';
import type { CapabilityContext } from '../contracts/context-plane.interface';

interface Entry {
  value: CapabilityContext;
  expiresAt: number;
  tenantId: string;
  capability: string;
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
    if (!entry) {
      this.misses++;
      return null;
    }
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    if (maxAgeMs != null) {
      const age = now - (entry.expiresAt - DEFAULT_TTL_MS);
      if (age > maxAgeMs) {
        this.misses++;
        return null;
      }
    }
    this.hits++;
    // Return a CACHED-marked copy.
    return { ...entry.value, cacheStatus: 'CACHED' };
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
    if (n > 0) {
      this.logger.debug(
        `Invalidated ${n} context cache entries (tenant=${tenantId}${
          capability ? `, capability=${capability}` : ''
        })`,
      );
    }
    return n;
  }

  stats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      invalidations: this.invalidations,
    };
  }
}
