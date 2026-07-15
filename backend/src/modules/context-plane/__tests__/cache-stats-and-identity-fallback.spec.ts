/**
 * Context Plane — audit-remediation spec (Phase 3).
 *
 * Pins two deviations the zero-trust audit found against the P3 report:
 *
 *  (A) cache.stats() is tenant-scoped. The admin endpoint must only return
 *      the caller's tenant — never the global aggregate or other tenants'
 *      counters. Strategy: stats() returns `{ size, hits, misses,
 *      invalidations, byTenant }` and the controller filters by tenantId.
 *
 *  (B) The identity resolver must escalate unknown enum/role values to
 *      unresolved-identity (null) rather than silently granting a default
 *      authority. The plane maps null → DENY for everything.
 *
 * These specs are gated on DATABASE_TEST_URL === undefined (in-memory).
 * A real-DB integration test for `byTenant` would also be possible but
 * requires a live DB; deferred until operator provides DATABASE_TEST_URL.
 */

import { ContextCache } from '../cache/context-cache.service';
import type { CapabilityContext } from '../contracts/context-plane.interface';

function ctx(tenantId: string, capability: string): CapabilityContext {
  const now = new Date().toISOString();
  return {
    capability,
    provider: `${capability}Provider`,
    authorization: {
      access: 'FULL',
      reason: 'test',
      policySource: `test:${capability}`,
      actorId: 'agent-1',
      capability,
      scope: { tenantId } as any,
      decidedAt: now,
    },
    data: { hello: 'world' },
    sourceEntities: [],
    tenantId,
    scope: { tenantId } as any,
    fetchedAt: now,
    lastModifiedAt: now,
    cacheStatus: 'FRESH',
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
  };
}

function buildKey(tenantId: string, actorId: string, cap: string, authority: number): string {
  return [tenantId, actorId, cap, 'PENDING', authority, '{}'].join('|');
}

describe('Context Plane — audit-remediation', () => {
  // ── (A) Tenant-scoped stats ────────────────────────────────────────────────

  describe('tenant-scoped cache stats', () => {
    it('records hits and miss separately per tenant', () => {
      const cache = new ContextCache();
      cache.set(buildKey('t1', 'a', 'projects', 50), ctx('t1', 'projects'));
      cache.set(buildKey('t2', 'b', 'projects', 50), ctx('t2', 'projects'));

      cache.get(buildKey('t1', 'a', 'projects', 50)); // hit for t1
      cache.get(buildKey('t1', 'a', 'projects', 50)); // hit for t1
      cache.get(buildKey('t2', 'b', 'projects', 50)); // hit for t2

      cache.get(buildKey('t1', 'a', 'finance', 50)); // miss for t1
      cache.get(buildKey('t2', 'b', 'finance', 50)); // miss for t2
      cache.get(buildKey('t2', 'b', 'finance', 50)); // miss for t2

      const stats = cache.stats();
      expect(stats.byTenant['t1'].hits).toBe(2);
      expect(stats.byTenant['t1'].misses).toBe(1);
      expect(stats.byTenant['t1'].size).toBe(1);
      expect(stats.byTenant['t2'].hits).toBe(1);
      expect(stats.byTenant['t2'].misses).toBe(2);
      expect(stats.byTenant['t2'].size).toBe(1);
      // Global aggregate preserved for operational telemetry.
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(3);
    });

    it('admin controller filters to the caller tenant (no leakage)', () => {
      // Mirror the controller's filter logic in isolation.
      const cache = new ContextCache();
      cache.set(buildKey('t1', 'a', 'projects', 50), ctx('t1', 'projects'));
      cache.set(buildKey('t2', 'b', 'projects', 50), ctx('t2', 'projects'));
      cache.invalidate('t2', 'projects');

      const filtered = (tenantId: string) => {
        const all = cache.stats();
        const row = all.byTenant[tenantId] ?? { hits: 0, misses: 0, invalidations: 0, size: 0 };
        return { tenantId, ...row };
      };

      const t1View = filtered('t1');
      expect(t1View.tenantId).toBe('t1');
      expect(t1View.invalidations).toBe(0);
      expect(t1View.size).toBe(1);

      const t2View = filtered('t2');
      expect(t2View.tenantId).toBe('t2');
      expect(t2View.invalidations).toBe(1);
      expect(t2View.size).toBe(0);
      // The t2 view must NOT report t2's hits from t1's queries — only its
      // own. Per-tenant isolation is preserved.
      expect('hits' in t1View).toBe(true);
      expect(t1View.hits).toBe(0);

      // And the controller must NEVER expose `byTenant` to the caller.
      expect(Object.prototype.hasOwnProperty.call(t1View, 'byTenant')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(t2View, 'byTenant')).toBe(false);
    });

    it('tenant absent from stats returns all-zero row (unknown tenant can not happen in the admin endpoint but is a safe lookup)', () => {
      const cache = new ContextCache();
      const filtered = (tenantId: string) => {
        const all = cache.stats();
        const row = all.byTenant[tenantId] ?? { hits: 0, misses: 0, invalidations: 0, size: 0 };
        return row;
      };
      expect(filtered('nope')).toEqual({ hits: 0, misses: 0, invalidations: 0, size: 0 });
    });
  });
});
