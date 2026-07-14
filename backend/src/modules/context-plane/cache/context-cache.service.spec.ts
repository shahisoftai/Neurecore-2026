/**
 * ContextCache — unit tests (Phase 3 §16 unit: cache key isolation, TTL,
 * invalidation).
 */

import { ContextCache } from './context-cache.service';
import type { CapabilityContext } from '../contracts/context-plane.interface';

function ctx(
  tenantId: string,
  capability: string,
  access: 'FULL' | 'REDACTED' | 'DENIED',
): CapabilityContext {
  const now = new Date().toISOString();
  return {
    capability,
    provider: 'p',
    authorization: {
      access,
      reason: 'r',
      policySource: 's',
      actorId: 'a',
      capability,
      scope: { tenantId },
      decidedAt: now,
    },
    data: { x: 1 },
    sourceEntities: [],
    tenantId,
    scope: { tenantId },
    fetchedAt: now,
    lastModifiedAt: null,
    cacheStatus: 'FRESH',
    expiresAt: now,
  };
}

describe('ContextCache', () => {
  it('isolates cache keys by tenant, actor, capability, access, authority', () => {
    const c = new ContextCache();
    const base = {
      tenantId: 't1',
      actorId: 'a1',
      capability: 'projects',
      access: 'FULL',
      effectiveAuthority: 90,
      scope: { projectId: 'p1' },
    };
    const k1 = c.key(base);
    const k2 = c.key({ ...base, tenantId: 't2' });
    const k3 = c.key({ ...base, actorId: 'a2' });
    const k4 = c.key({ ...base, access: 'REDACTED' });
    const k5 = c.key({ ...base, effectiveAuthority: 40 });
    const k6 = c.key({ ...base, capability: 'finance' });
    const keys = new Set([k1, k2, k3, k4, k5, k6]);
    expect(keys.size).toBe(6); // all distinct
  });

  it('does NOT reuse a response across actors with different authorization', () => {
    const c = new ContextCache();
    const kFull = c.key({
      tenantId: 't1',
      actorId: 'a1',
      capability: 'projects',
      access: 'FULL',
      effectiveAuthority: 90,
      scope: {},
    });
    const kRedacted = c.key({
      tenantId: 't1',
      actorId: 'a2',
      capability: 'projects',
      access: 'REDACTED',
      effectiveAuthority: 40,
      scope: {},
    });
    c.set(kFull, ctx('t1', 'projects', 'FULL'));
    // a2's redacted key must miss (no cross-actor/authorization reuse).
    expect(c.get(kRedacted)).toBeNull();
    expect(c.get(kFull)?.authorization.access).toBe('FULL');
  });

  it('honours TTL expiry', () => {
    const c = new ContextCache();
    const k = c.key({
      tenantId: 't1',
      actorId: 'a1',
      capability: 'projects',
      access: 'FULL',
      effectiveAuthority: 90,
      scope: {},
    });
    c.set(k, ctx('t1', 'projects', 'FULL'), 1); // 1ms TTL
    return new Promise((r) => setTimeout(r, 5)).then(() => {
      expect(c.get(k)).toBeNull();
    });
  });

  it('marks cache hits as CACHED', () => {
    const c = new ContextCache();
    const k = c.key({
      tenantId: 't1',
      actorId: 'a1',
      capability: 'projects',
      access: 'FULL',
      effectiveAuthority: 90,
      scope: {},
    });
    c.set(k, ctx('t1', 'projects', 'FULL'));
    expect(c.get(k)?.cacheStatus).toBe('CACHED');
  });

  it('invalidates tenant + capability scoped entries only', () => {
    const c = new ContextCache();
    const mk = (t: string, cap: string) =>
      c.key({
        tenantId: t,
        actorId: 'a',
        capability: cap,
        access: 'FULL',
        effectiveAuthority: 90,
        scope: {},
      });
    c.set(mk('t1', 'projects'), ctx('t1', 'projects', 'FULL'));
    c.set(mk('t1', 'finance'), ctx('t1', 'finance', 'FULL'));
    c.set(mk('t2', 'projects'), ctx('t2', 'projects', 'FULL'));

    // Invalidate only t1/projects.
    expect(c.invalidate('t1', 'projects')).toBe(1);
    expect(c.get(mk('t1', 'projects'))).toBeNull();
    expect(c.get(mk('t1', 'finance'))).not.toBeNull(); // untouched
    expect(c.get(mk('t2', 'projects'))).not.toBeNull(); // other tenant untouched
  });

  it('invalidates all capabilities for a tenant when capability omitted', () => {
    const c = new ContextCache();
    const mk = (cap: string) =>
      c.key({
        tenantId: 't1',
        actorId: 'a',
        capability: cap,
        access: 'FULL',
        effectiveAuthority: 90,
        scope: {},
      });
    c.set(mk('projects'), ctx('t1', 'projects', 'FULL'));
    c.set(mk('finance'), ctx('t1', 'finance', 'FULL'));
    expect(c.invalidate('t1')).toBe(2);
  });
});
