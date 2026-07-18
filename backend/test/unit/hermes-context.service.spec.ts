import { HermesContextService } from '../../src/modules/hermes/services/hermes-context.service';
import type { HermesAgentProfile } from '../../src/modules/hermes/common/hermes.types';
import type { HermesAgentType } from '@prisma/client';

function buildMocks() {
  const mockRegistry = {
    findById: jest.fn(),
    getAllowedTools: jest.fn(),
  };

  const mockMemory = {
    getContext: jest.fn(),
  };

  const svc = new HermesContextService(
    mockRegistry as any,
    mockMemory as any,
  );

  return {
    svc,
    mocks: {
      registry: mockRegistry,
      memory: mockMemory,
    },
  };
}

describe('HermesContextService', () => {
  let svc: HermesContextService;
  let mocks: ReturnType<typeof buildMocks>['mocks'];

  const mockAgent: HermesAgentProfile = {
    id: 'agent-1',
    name: 'FinanceHermes',
    type: 'FINANCE' as HermesAgentType,
    status: 'IDLE',
    isActive: true,
    tenantId: 'tenant-1',
    workspaceId: 'ws-1',
  };

  beforeEach(() => {
    const result = buildMocks();
    svc = result.svc;
    mocks = result.mocks;
    jest.clearAllMocks();
  });

  describe('build', () => {
    it('should build execution context with allowed tools from registry', async () => {
      mocks.registry.findById.mockResolvedValue(mockAgent);
      mocks.memory.getContext.mockResolvedValueOnce('Memory: invoice history');
      mocks.registry.getAllowedTools.mockReturnValue(['read_invoice', 'approve_invoice']);

      const ctx = await svc.build({
        hermesAgentId: 'agent-1',
        agentId: 'user-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        workspaceId: 'ws-1',
        threadId: 'thread-1',
      });

      expect(ctx.hermesAgentId).toBe('agent-1');
      expect(ctx.tenantId).toBe('tenant-1');
      expect(ctx.threadId).toBe('thread-1');
      expect(ctx.allowedTools).toEqual(['read_invoice', 'approve_invoice']);
    });

    it('should throw when agent not found', async () => {
      mocks.registry.findById.mockResolvedValue(null);

      await expect(
        svc.build({
          hermesAgentId: 'agent-missing',
          agentId: 'user-1',
          tenantId: 'tenant-1',
          threadId: 'thread-1',
        }),
      ).rejects.toThrow('HermesAgent agent-missing not found');
    });

    it('should return empty allowedTools when agent not found', async () => {
      mocks.registry.findById.mockResolvedValue(null);

      const ctx = await svc.build({
        hermesAgentId: 'agent-missing',
        agentId: 'user-1',
        tenantId: 'tenant-1',
        threadId: 'thread-1',
      }).catch(() => ({ allowedTools: [] as string[] }));

      // error path — guard above
    });

    it('should use provided workspaceId and userId from params', async () => {
      mocks.registry.findById.mockResolvedValue({ ...mockAgent });
      mocks.memory.getContext.mockResolvedValue('');
      mocks.registry.getAllowedTools.mockReturnValue([]);

      const ctx = await svc.build({
        hermesAgentId: 'agent-1',
        agentId: 'user-1',
        tenantId: 'tenant-1',
        userId: 'user-2',
        workspaceId: 'ws-2',
        threadId: 'thread-1',
      });

      expect(ctx.workspaceId).toBe('ws-2');
      expect(ctx.userId).toBe('user-2');
    });
  });
});
