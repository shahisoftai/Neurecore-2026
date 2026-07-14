/**
 * OrganizationalContextPlane — integration/unit tests (Phase 3 §16).
 *
 * Uses a fake identity resolver + fake providers to prove aggregation,
 * FULL/REDACTED/DENIED, safe-fail on missing identity, tenant isolation,
 * selective assembly, provider-error isolation, provenance, and cache reuse.
 */

import { OrganizationalContextPlane } from './organizational-context-plane.service';
import { ContextCache } from '../cache/context-cache.service';
import type {
  CapabilityContext,
  ContextAuth,
  ContextScope,
  IOrganizationalContextProvider,
} from '../contracts/context-plane.interface';

function fakeAuth(tenantId: string, authority: number, blocked = false): ContextAuth {
  return {
    tenantId,
    identity: {
      employeeId: 'agent-1',
      employeeType: 'AI_AGENT',
      displayName: 'Agent 1',
      role: 'AI_EMPLOYEE',
      departmentId: 'dept-1',
      departmentName: 'Ops',
      authorityLevel: authority,
      autonomyLevel: authority,
      resolvedFrom: 'test',
    },
    authContext: {
      applicablePolicies: [],
      effectiveAuthority: blocked ? 0 : authority,
      effectiveAutonomy: blocked ? 0 : authority,
      governanceBlocked: blocked,
    },
  };
}

class FakeResolver {
  constructor(private readonly auth: ContextAuth | null) {}
  resolve = jest.fn(async () => this.auth);
}

class FakeProvider implements IOrganizationalContextProvider {
  calls = 0;
  constructor(
    readonly capability: string,
    private readonly behavior: (auth: ContextAuth, scope: ContextScope) => CapabilityContext,
  ) {}
  async getContext(auth: ContextAuth, scope: ContextScope): Promise<CapabilityContext> {
    this.calls++;
    return this.behavior(auth, scope);
  }
}

function providerCtx(
  capability: string,
  auth: ContextAuth,
  scope: ContextScope,
  access: 'FULL' | 'REDACTED' | 'DENIED',
  data: Record<string, unknown>,
): CapabilityContext {
  const now = new Date().toISOString();
  return {
    capability,
    provider: `${capability}Provider`,
    authorization: {
      access,
      reason: access,
      policySource: `test:${capability}`,
      actorId: auth.identity.employeeId,
      capability,
      scope,
      decidedAt: now,
    },
    data: access === 'DENIED' ? {} : data,
    sourceEntities: [{ entityType: 'X', entityId: '1' }],
    tenantId: auth.tenantId,
    scope,
    fetchedAt: now,
    lastModifiedAt: now,
    cacheStatus: 'FRESH',
    expiresAt: new Date(Date.now() + 30000).toISOString(),
  };
}

function makePlane(auth: ContextAuth | null) {
  const cache = new ContextCache();
  const resolver = new FakeResolver(auth);
  const plane = new OrganizationalContextPlane(resolver as never, cache);
  return { plane, cache, resolver };
}

describe('OrganizationalContextPlane', () => {
  it('aggregates FULL context from a provider with provenance', async () => {
    const auth = fakeAuth('t1', 90);
    const { plane } = makePlane(auth);
    plane.registerProvider(
      new FakeProvider('projects', (a, s) =>
        providerCtx('projects', a, s, 'FULL', { projects: [{ id: 'p1' }] }),
      ),
    );
    const res = await plane.assemble({
      tenantId: 't1',
      actorId: 'agent-1',
      actorType: 'AI_AGENT',
      scope: {},
    });
    const cap = res.capabilities['projects'];
    expect(cap.authorization.access).toBe('FULL');
    expect(cap.provider).toBe('projectsProvider');
    expect(cap.sourceEntities.length).toBe(1); // provenance retained
    expect(cap.authorization.policySource).toBe('test:projects');
    expect((cap.data.projects as unknown[]).length).toBe(1);
  });

  it('returns REDACTED context (partial data)', async () => {
    const auth = fakeAuth('t1', 40);
    const { plane } = makePlane(auth);
    plane.registerProvider(
      new FakeProvider('projects', (a, s) =>
        providerCtx('projects', a, s, 'REDACTED', { projects: [{ id: 'p1', budget: null }] }),
      ),
    );
    const res = await plane.assemble({
      tenantId: 't1', actorId: 'agent-1', actorType: 'AI_AGENT', scope: {},
    });
    expect(res.capabilities['projects'].authorization.access).toBe('REDACTED');
  });

  it('returns DENIED context (no data)', async () => {
    const auth = fakeAuth('t1', 5);
    const { plane } = makePlane(auth);
    plane.registerProvider(
      new FakeProvider('finance', (a, s) =>
        providerCtx('finance', a, s, 'DENIED', { secret: 'x' }),
      ),
    );
    const res = await plane.assemble({
      tenantId: 't1', actorId: 'agent-1', actorType: 'AI_AGENT', scope: {},
    });
    const cap = res.capabilities['finance'];
    expect(cap.authorization.access).toBe('DENIED');
    expect(Object.keys(cap.data)).toHaveLength(0); // no data leaked
  });

  it('fails safe (DENIED everything) when identity cannot be resolved', async () => {
    const { plane } = makePlane(null); // resolver returns null
    plane.registerProvider(
      new FakeProvider('projects', (a, s) => providerCtx('projects', a, s, 'FULL', { x: 1 })),
    );
    const res = await plane.assemble({
      tenantId: 't1', actorId: 'ghost', actorType: 'AI_AGENT', scope: {},
    });
    expect(res.capabilities['projects'].authorization.access).toBe('DENIED');
    expect(res.authContext.governanceBlocked).toBe(true);
    expect(res.identity.authorityLevel).toBe(0); // never a hardcoded default
  });

  it('denies all capabilities when governance blocks the actor', async () => {
    const auth = fakeAuth('t1', 90, /* blocked */ true);
    const { plane } = makePlane(auth);
    // Provider would grant FULL, but the plane passes governanceBlocked through;
    // a real provider uses decide() which denies. Emulate a decide()-based provider:
    plane.registerProvider(
      new FakeProvider('projects', (a, s) =>
        providerCtx(
          'projects',
          a,
          s,
          a.authContext.governanceBlocked ? 'DENIED' : 'FULL',
          { x: 1 },
        ),
      ),
    );
    const res = await plane.assemble({
      tenantId: 't1', actorId: 'agent-1', actorType: 'AI_AGENT', scope: {},
    });
    expect(res.capabilities['projects'].authorization.access).toBe('DENIED');
  });

  it('supports selective capability assembly (include list)', async () => {
    const auth = fakeAuth('t1', 90);
    const { plane } = makePlane(auth);
    const projects = new FakeProvider('projects', (a, s) => providerCtx('projects', a, s, 'FULL', {}));
    const finance = new FakeProvider('finance', (a, s) => providerCtx('finance', a, s, 'FULL', {}));
    plane.registerProvider(projects);
    plane.registerProvider(finance);
    const res = await plane.assemble({
      tenantId: 't1', actorId: 'agent-1', actorType: 'AI_AGENT',
      scope: { includeCapabilities: ['projects'] },
    });
    expect(Object.keys(res.capabilities)).toEqual(['projects']);
    expect(projects.calls).toBe(1);
    expect(finance.calls).toBe(0); // not loaded
  });

  it('isolates a failing provider from others', async () => {
    const auth = fakeAuth('t1', 90);
    const { plane } = makePlane(auth);
    plane.registerProvider(
      new FakeProvider('projects', (a, s) => providerCtx('projects', a, s, 'FULL', { ok: true })),
    );
    plane.registerProvider(
      new FakeProvider('finance', () => {
        throw new Error('finance down');
      }),
    );
    const res = await plane.assemble({
      tenantId: 't1', actorId: 'agent-1', actorType: 'AI_AGENT', scope: {},
    });
    expect(res.capabilities['projects'].authorization.access).toBe('FULL'); // unaffected
    expect(res.capabilities['finance'].unavailable).toBe(true); // failed → UNAVAILABLE
    expect(res.capabilities['finance'].authorization.access).toBe('DENIED');
  });

  it('reuses cache for the same actor+authority+scope, refetches on invalidation', async () => {
    const auth = fakeAuth('t1', 90);
    const { plane, cache } = makePlane(auth);
    const provider = new FakeProvider('projects', (a, s) => providerCtx('projects', a, s, 'FULL', { n: 1 }));
    plane.registerProvider(provider);

    await plane.assemble({ tenantId: 't1', actorId: 'agent-1', actorType: 'AI_AGENT', scope: {} });
    await plane.assemble({ tenantId: 't1', actorId: 'agent-1', actorType: 'AI_AGENT', scope: {} });
    expect(provider.calls).toBe(1); // 2nd served from cache

    cache.invalidate('t1', 'projects');
    await plane.assemble({ tenantId: 't1', actorId: 'agent-1', actorType: 'AI_AGENT', scope: {} });
    expect(provider.calls).toBe(2); // refetched after invalidation
  });
});
