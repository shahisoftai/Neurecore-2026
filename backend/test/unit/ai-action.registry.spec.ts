import {
  AIActionRegistry,
  tierMeetsRequirement,
} from '../../src/modules/ai-actions/ai-action.registry';
import type {
  AIActionDefinition,
  AIActionPermission,
} from '../../src/modules/ai-actions/action-definition';

/**
 * Unit tests for AIActionRegistry — Phase 5, Task 5.1.
 *
 * Covers:
 *   - register() / getById() / getAll()
 *   - getByEntity() wildcard handling
 *   - getAvailable() filters on tier + permissions + entity
 *   - validateInvocation() error paths
 *   - deprecate() removes from getAvailable()
 *   - tierMeetsRequirement() helper
 */

function makeAction(
  partial: Partial<AIActionDefinition> & { id: string; name: string },
): AIActionDefinition {
  return {
    description: 'desc',
    category: 'INTELLIGENCE',
    capability: 'intelligence',
    tags: [],
    supportedEntities: ['*'],
    requiredPermissions: ['ai.invoke'],
    requiresStreaming: false,
    timeoutMs: 1000,
    maxRetries: 0,
    costModel: {
      type: 'per_token',
      tokensEstimate: 100,
      tierRequired: 'COMMUNITY',
    },
    version: '1.0.0',
    status: 'stable',
    handler: (async () => ({ output: 'ok' })) as AIActionDefinition['handler'],
    ...partial,
  } as AIActionDefinition;
}

describe('AIActionRegistry', () => {
  let registry: AIActionRegistry;

  beforeEach(() => {
    registry = new AIActionRegistry();
  });

  it('registers and retrieves actions', () => {
    registry.register(makeAction({ id: 'ai:summary', name: 'Summary' }));
    expect(registry.getById('ai:summary')?.name).toBe('Summary');
    expect(registry.getAll()).toHaveLength(1);
  });

  it('throws on duplicate registration', () => {
    registry.register(makeAction({ id: 'ai:summary', name: 'Summary' }));
    expect(() =>
      registry.register(makeAction({ id: 'ai:summary', name: 'Dup' })),
    ).toThrow(/duplicate/);
  });

  it('deprecates an action so it is filtered from getAvailable', () => {
    registry.register(makeAction({ id: 'ai:summary', name: 'Summary' }));
    registry.deprecate('ai:summary', 'ai:summary:v2');
    expect(registry.getById('ai:summary')?.status).toBe('deprecated');
    expect(registry.getAvailable(undefined, ['ai.invoke'], 'COMMUNITY')).toHaveLength(0);
  });

  it('getByEntity returns actions that support *', () => {
    registry.register(makeAction({ id: 'a1', name: 'A1' }));
    registry.register(
      makeAction({
        id: 'a2',
        name: 'A2',
        supportedEntities: ['DEPARTMENT'],
      }),
    );
    expect(registry.getByEntity('DEPARTMENT').map((a) => a.id).sort()).toEqual([
      'a1',
      'a2',
    ]);
    expect(registry.getByEntity('TASK').map((a) => a.id)).toEqual(['a1']);
  });

  it('getAvailable filters by tier, permissions, and entity', () => {
    registry.register(
      makeAction({
        id: 'community',
        name: 'Community',
        costModel: { type: 'per_token', tokensEstimate: 100, tierRequired: 'COMMUNITY' },
      }),
    );
    registry.register(
      makeAction({
        id: 'pro',
        name: 'Pro',
        costModel: { type: 'per_token', tokensEstimate: 100, tierRequired: 'PRO' },
        requiredPermissions: ['ai.invoke', 'ai.invoke.delegate'],
      }),
    );
    registry.register(
      makeAction({
        id: 'dept',
        name: 'Dept',
        supportedEntities: ['DEPARTMENT'],
      }),
    );

    // COMMUNITY tier + USER permissions
    const communityView = registry.getAvailable(
      undefined,
      ['ai.invoke'],
      'COMMUNITY',
    );
    expect(communityView.map((a) => a.id).sort()).toEqual(['community', 'dept']);

    // STARTER tier still can't invoke PRO actions
    const starterView = registry.getAvailable(
      undefined,
      ['ai.invoke', 'ai.invoke.delegate'],
      'STARTER',
    );
    expect(starterView.map((a) => a.id)).toEqual(['community', 'dept']);

    // PRO + OWNER permissions, scoped to DEPARTMENT
    const proView = registry.getAvailable(
      'DEPARTMENT',
      ['ai.invoke', 'ai.invoke.delegate'],
      'PRO',
    );
    expect(proView.map((a) => a.id).sort()).toEqual(['community', 'dept', 'pro']);
  });

  it('validateInvocation returns a typed error for unknown actions', () => {
    const r = registry.validateInvocation({
      actionId: 'nope',
      userPermissions: ['ai.invoke'],
      tier: 'COMMUNITY',
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Unknown AI Action/);
  });

  it('validateInvocation reports missing permissions', () => {
    registry.register(
      makeAction({
        id: 'admin-only',
        name: 'Admin Only',
        requiredPermissions: ['ai.invoke.workflow'],
      }),
    );
    const r = registry.validateInvocation({
      actionId: 'admin-only',
      userPermissions: ['ai.invoke'],
      tier: 'COMMUNITY',
    });
    expect(r.allowed).toBe(false);
    expect(r.missingPermissions).toEqual(['ai.invoke.workflow']);
  });
});

describe('tierMeetsRequirement', () => {
  it('orders tiers correctly', () => {
    expect(tierMeetsRequirement('ENTERPRISE', 'COMMUNITY')).toBe(true);
    expect(tierMeetsRequirement('STARTER', 'PRO')).toBe(false);
    expect(tierMeetsRequirement('PRO', 'PRO')).toBe(true);
  });

  it('treats unknown tiers as fail-closed', () => {
    // COMMUNITY does NOT meet STARTER requirement (must upgrade).
    expect(tierMeetsRequirement('COMMUNITY', 'STARTER')).toBe(false);
    // Unknown tenant tier fails closed.
    expect(tierMeetsRequirement('UNKNOWN' as never, 'STARTER')).toBe(false);
  });
});

describe('AIActionDefinition required permissions shape', () => {
  it('accepts the documented permission strings', () => {
    const perms: AIActionPermission[] = [
      'ai.invoke',
      'ai.invoke.analysis',
      'ai.invoke.optimization',
      'ai.invoke.execution',
      'ai.invoke.reporting',
      'ai.invoke.delegate',
      'ai.invoke.workflow',
    ];
    expect(perms).toHaveLength(7);
  });
});
