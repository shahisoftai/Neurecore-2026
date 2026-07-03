import { HermesRouter } from '../../src/modules/hermes/langgraph/hermes-router';
import { HermesAgentType } from '@prisma/client';

function buildMocks() {
  const mockRegistry = {
    findByType: jest.fn(),
    listAgents: jest.fn(),
  };

  const mockSessionService = {
    create: jest.fn(),
  };

  const router = new HermesRouter(mockRegistry as any, mockSessionService as any);
  return { router, registry: mockRegistry, sessions: mockSessionService };
}

describe('HermesRouter', () => {
  let router: HermesRouter;
  let registry: ReturnType<typeof buildMocks>['registry'];
  let sessions: ReturnType<typeof buildMocks>['sessions'];

  beforeEach(() => {
    const built = buildMocks();
    router = built.router;
    registry = built.registry;
    sessions = built.sessions;
    jest.clearAllMocks();
  });

  describe('route', () => {
    it('should route finance tasks to FINANCE agent', async () => {
      registry.findByType.mockResolvedValueOnce([{
        id: 'finance-1',
        type: HermesAgentType.FINANCE,
        status: 'IDLE',
        isActive: true,
        name: 'Finance Agent',
        capabilities: [],
        toolPermissions: [],
        cost: { totalSpend: 0, dailyBudget: 100 },
      }]);

      sessions.create.mockResolvedValueOnce({
        id: 'session-1',
        hermesAgentId: 'finance-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        threadId: 'thread-1',
        status: 'ACTIVE',
        context: {},
        workspaceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      });

      const result = await router.route(
        'Process invoice #123 for $5,000',
        'tenant-1',
        'user-1',
      );

      expect(result).not.toBeNull();
      expect(result?.hermesType).toBe('FINANCE');
      expect(result?.hermesAgentId).toBe('finance-1');
      expect(result?.sessionId).toBe('session-1');
    });

    it('should route HR tasks to HR agent', async () => {
      registry.findByType.mockResolvedValueOnce([{
        id: 'hr-1',
        type: HermesAgentType.HR,
        status: 'IDLE',
        isActive: true,
        name: 'HR Agent',
        capabilities: [],
        toolPermissions: [],
        cost: { totalSpend: 0, dailyBudget: 100 },
      }]);

      sessions.create.mockResolvedValueOnce({ id: 'session-2', hermesAgentId: 'hr-1', userId: 'user-1', tenantId: 'tenant-1', threadId: 't2', status: 'ACTIVE', context: {}, workspaceId: null, createdAt: new Date(), updatedAt: new Date(), expiresAt: null });

      const result = await router.route('Hire a new developer', 'tenant-1', 'user-1');
      expect(result?.hermesType).toBe('HR');
    });

    it('should return null when no agent matches', async () => {
      registry.findByType.mockResolvedValueOnce([]);
      registry.listAgents.mockResolvedValueOnce([]);

      const result = await router.route('Do something random', 'tenant-1', 'user-1');
      expect(result).toBeNull();
    });
  });
});
