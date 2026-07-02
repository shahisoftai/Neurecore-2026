import { HermesRouterNode } from '../../src/modules/hermes/langgraph/hermes-router';

function buildMocks() {
  const mockRouter = {
    route: jest.fn(),
  };

  const node = new HermesRouterNode(mockRouter as any);
  return { node, router: mockRouter };
}

describe('HermesRouterNode', () => {
  let node: HermesRouterNode;
  let router: ReturnType<typeof buildMocks>['router'];

  beforeEach(() => {
    const { node: n, router: r } = buildMocks();
    node = n;
    router = r;
    jest.clearAllMocks();
  });

  describe('route', () => {
    it('should return routed agent ID on success', async () => {
      router.route.mockResolvedValueOnce({
        agentId: 'agent-finance-1',
        agentType: 'FINANCE',
        confidence: 0.9,
        reasoning: 'Auto-detected',
      });

      const result = await node.route({
        tenantId: 'tenant-1',
        userId: 'user-1',
        task: 'Process invoice',
        preferredAgentType: null,
        routedAgentId: null,
        routedAgentType: null,
        result: null,
        error: null,
        success: true,
        shouldContinue: true,
      } as any);

      expect(result.routedAgentId).toBe('agent-finance-1');
      expect(result.shouldContinue).toBe(true);
    });

    it('should return error when no task provided', async () => {
      const result = await node.route({
        tenantId: 'tenant-1',
        userId: 'user-1',
        task: null,
        success: true,
        shouldContinue: true,
      } as any);

      expect(result.error).toBe('No task provided');
      expect(result.success).toBe(false);
      expect(result.shouldContinue).toBe(false);
    });

    it('should propagate router errors', async () => {
      router.route.mockRejectedValueOnce(new Error('No agents available'));

      const result = await node.route({
        tenantId: 'tenant-1',
        userId: 'user-1',
        task: 'Do something',
        success: true,
        shouldContinue: true,
      } as any);

      expect(result.error).toBe('No agents available');
      expect(result.success).toBe(false);
    });
  });
});
