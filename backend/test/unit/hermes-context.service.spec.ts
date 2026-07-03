import { HermesContextService } from '../../src/modules/hermes/services/hermes-context.service';
import { HermesAgentType } from '@prisma/client';

function buildMocks() {
  const prisma: any = {
    hermesAgent: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockRegistry = {
    findById: jest.fn(),
  };

  const mockMemory = {
    search: jest.fn(),
    getContext: jest.fn(),
  };

  const mockToolGateway = {
    buildToolMenu: jest.fn(),
  };

  const svc = new HermesContextService(
    prisma as any,
    mockRegistry as any,
    mockMemory as any,
    mockToolGateway as any,
  );

  return { svc, mocks: { prisma, registry: mockRegistry, memory: mockMemory, toolGateway: mockToolGateway } };
}

describe('HermesContextService', () => {
  let svc: HermesContextService;
  let mocks: ReturnType<typeof buildMocks>['mocks'];

  beforeEach(() => {
    const built = buildMocks();
    svc = built.svc;
    mocks = built.mocks;
    jest.clearAllMocks();
  });

  describe('getAgentContext', () => {
    it('should return agent context from Prisma', async () => {
      mocks.prisma.hermesAgent.findFirst.mockResolvedValueOnce({
        id: 'agent-1',
        name: 'Test Agent',
        type: HermesAgentType.CUSTOM,
        status: 'IDLE',
        model: 'gpt-4o-mini',
        systemPrompt: 'Test prompt',
        tenantId: 'tenant-1',
        workspaceId: null,
        config: {},
      });

      const ctx = await svc.getAgentContext('agent-1', 'tenant-1');
      expect(ctx.agentId).toBe('agent-1');
      expect(ctx.name).toBe('Test Agent');
      expect(ctx.type).toBe(HermesAgentType.CUSTOM);
      expect(ctx.model).toBe('gpt-4o-mini');
    });

    it('should throw when agent not found', async () => {
      mocks.prisma.hermesAgent.findFirst.mockResolvedValueOnce(null);

      await expect(
        svc.getAgentContext('nonexistent', 'tenant-1'),
      ).rejects.toThrow('Hermes agent nonexistent not found');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build prompt with agent info and memory', () => {
      const agent = {
        agentId: 'a1',
        name: 'TestBot',
        type: HermesAgentType.CUSTOM,
        status: 'IDLE' as any,
        model: 'gpt-4o-mini',
        systemPrompt: 'You are a test agent.',
        tenantId: 't1',
      };

      const memoryCtx = {
        personal: ['Learned: company policy X'],
        episodic: ['Processed invoice #456'],
        procedural: new Map([['process_invoice', 'Step 1: Verify, Step 2: Approve']]),
      };

      const prompt = svc.buildSystemPrompt(agent, memoryCtx);
      expect(prompt).toContain('You are a test agent.');
      expect(prompt).toContain('STANDARD OPERATING PROCEDURES');
      expect(prompt).toContain('Step 1: Verify');
      expect(prompt).toContain('company policy X');
    });
  });

  describe('buildToolContext', () => {
    it('should return tool context with permissions', async () => {
      mocks.prisma.hermesAgent.findFirst.mockResolvedValueOnce({
        id: 'agent-1',
        type: HermesAgentType.CUSTOM,
        tenantId: 'tenant-1',
        toolPermissions: [
          { toolName: 'email', permission: 'ALLOW' },
          { toolName: 'docs', permission: 'DENY' },
        ],
      });

      mocks.toolGateway.buildToolMenu.mockResolvedValueOnce([
        { name: 'email', description: 'Send email', permission: 'ALLOW' },
        { name: 'docs', description: 'Documents', permission: 'DENY' },
      ]);

      const ctx = await svc.buildToolContext('agent-1', 'tenant-1');
      expect(ctx.allowedTools).toContain('email');
      expect(ctx.deniedTools).toContain('docs');
    });
  });

  describe('buildExecutionContext', () => {
    it('should build full execution context', async () => {
      mocks.prisma.hermesAgent.findFirst.mockResolvedValueOnce({
        id: 'agent-1',
        name: 'Agent',
        type: HermesAgentType.CUSTOM,
        status: 'IDLE',
        model: 'gpt-4o-mini',
        systemPrompt: 'Test',
        tenantId: 'tenant-1',
        workspaceId: null,
        config: {},
        toolPermissions: [],
      });

      mocks.prisma.hermesAgent.findUnique.mockResolvedValueOnce({ config: {} });
      mocks.toolGateway.buildToolMenu.mockResolvedValueOnce([]);
      mocks.memory.search.mockResolvedValue([]);

      const ctx = await svc.buildExecutionContext('agent-1', 'tenant-1', 'session-1');
      expect(ctx.systemPrompt).toBeDefined();
      expect(ctx.tools).toBeDefined();
      expect(ctx.memory).toBeDefined();
    });
  });
});
