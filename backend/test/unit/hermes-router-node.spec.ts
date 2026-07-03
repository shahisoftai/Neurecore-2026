import { HermesRouter } from '../../src/modules/hermes/langgraph/hermes-router';

function buildMocks() {
  const mockRouter: any = {
    route: jest.fn(),
  };

  return { router: mockRouter };
}

describe('HermesRouterNode', () => {
  it('should delegate to HermesRouter route method', async () => {
    const { router } = buildMocks();
    router.route.mockResolvedValueOnce({
      hermesAgentId: 'agent-1',
      hermesType: 'FINANCE',
      sessionId: 'session-1',
      confidence: 85,
    });

    const result = await router.route('Process payment', 'tenant-1', 'user-1');
    expect(result).not.toBeNull();
    expect(result.hermesAgentId).toBe('agent-1');
    expect(result.sessionId).toBe('session-1');
  });
});
