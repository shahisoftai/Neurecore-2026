import { HermesContextService } from '../../src/modules/hermes/services/hermes-context.service';
import type {
  HermesExecutionRequest,
  HermesExecutionContext,
} from '../../src/modules/hermes/interfaces/hermes-runtime.interface';

function buildMocks() {
  const mockRegistry = {
    findById: jest.fn(),
  };

  const mockMemory = {
    getContext: jest.fn(),
  };

  const mockGovernance = {
    evaluate: jest.fn(),
  };

  const mockToolGateway = {
    getAllowedTools: jest.fn(),
  };

  const svc = new HermesContextService(
    mockRegistry as any,
    mockMemory as any,
    mockGovernance as any,
    mockToolGateway as any,
  );

  return {
    svc,
    mocks: {
      registry: mockRegistry,
      memory: mockMemory,
      governance: mockGovernance,
      toolGateway: mockToolGateway,
    },
  };
}

describe('HermesContextService', () => {
  let svc: HermesContextService;
  let mocks: ReturnType<typeof buildMocks>['mocks'];

  const mockAgent = {
    id: 'agent-1',
    name: 'FinanceHermes',
    type: 'FINANCE' as const,
    status: 'IDLE' as const,
    isActive: true,
    tenantId: 'tenant-1',
    workspaceId: 'ws-1',
    permissions: ['invoice:read', 'invoice:approve'],
    systemPrompt: 'You are a finance agent.',
    model: 'mini-max',
  };

  const baseRequest: HermesExecutionRequest = {
    sessionId: 'session-1',
    hermesAgentId: 'agent-1',
    task: 'Process invoice #123',
    context: {
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      threadId: 'thread-1',
    },
  };

  beforeEach(() => {
    const { svc: service, mocks: m } = buildMocks();
    svc = service;
    mocks = m;
    jest.clearAllMocks();
  });

  describe('build', () => {
    it('should build execution context from request', async () => {
      mocks.registry.findById.mockResolvedValue(mockAgent);
      mocks.memory.getContext.mockResolvedValueOnce('Recent: processed invoice #100');
      mocks.governance.evaluate.mockResolvedValueOnce({
        requiresApproval: false,
        triggeredRules: [],
        actions: [],
      });
      mocks.toolGateway.getAllowedTools.mockResolvedValueOnce(['read_invoice', 'approve_invoice']);

      const ctx = await svc.build(baseRequest);

      expect(ctx.hermesAgentId).toBe('agent-1');
      expect(ctx.tenantId).toBe('tenant-1');
      expect(ctx.task).toBe('Process invoice #123');
      expect(ctx.systemPrompt).toContain('You are a finance agent.');
      expect(ctx.allowedTools).toEqual(['read_invoice', 'approve_invoice']);
    });

    it('should throw when agent not found', async () => {
      mocks.registry.findById.mockResolvedValueOnce(null);

      await expect(svc.build(baseRequest)).rejects.toThrow('HermesAgent agent-1 not found');
    });

    it('should use provided tools over allowed tools', async () => {
      mocks.registry.findById.mockResolvedValueOnce(mockAgent);
      mocks.memory.getContext.mockResolvedValue('');
      mocks.governance.evaluate.mockResolvedValue({ requiresApproval: false, triggeredRules: [], actions: [] });
      mocks.toolGateway.getAllowedTools.mockResolvedValue(['read_invoice', 'approve_invoice']);

      const requestWithTools = {
        ...baseRequest,
        tools: ['custom_tool'],
      };

      const ctx = await svc.build(requestWithTools);
      expect(ctx.allowedTools).toEqual(['custom_tool']);
    });
  });

  describe('buildSystemPrompt', () => {
    it('should return agent system prompt with memory', async () => {
      mocks.registry.findById.mockResolvedValue(mockAgent);
      mocks.memory.getContext.mockResolvedValueOnce('Memory: previously approved invoices from Acme Corp');

      const prompt = await svc.buildSystemPrompt('agent-1', 'tenant-1');

      expect(prompt).toContain('You are a finance agent.');
      expect(prompt).toContain('## Recent Memory');
    });

    it('should return empty string when agent not found', async () => {
      mocks.registry.findById.mockResolvedValueOnce(null);
      const prompt = await svc.buildSystemPrompt('agent-1', 'tenant-1');
      expect(prompt).toBe('');
    });

    it('should use default prompt for FINANCE type', async () => {
      mocks.registry.findById.mockResolvedValueOnce({ ...mockAgent, systemPrompt: undefined });
      mocks.memory.getContext.mockResolvedValue('');

      const prompt = await svc.buildSystemPrompt('agent-1', 'tenant-1');

      expect(prompt).toContain('Finance Hermes agent');
    });

    it('should use default prompt for HR type', async () => {
      mocks.registry.findById.mockResolvedValueOnce({ ...mockAgent, type: 'HR' as const, systemPrompt: undefined });
      mocks.memory.getContext.mockResolvedValue('');

      const prompt = await svc.buildSystemPrompt('agent-1', 'tenant-1');
      expect(prompt).toContain('HR Hermes agent');
    });
  });

  describe('injectMemory', () => {
    it('should return memory context string', async () => {
      mocks.memory.getContext.mockResolvedValueOnce('[PERSONAL] User prefers email notifications');

      const ctx: HermesExecutionContext = {
        sessionId: 'session-1',
        hermesAgentId: 'agent-1',
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        threadId: 'thread-1',
        task: 'Test',
        systemPrompt: '',
        memoryContext: '',
        allowedTools: [],
        governanceContext: { requiresApproval: false, blockedRules: [], rateLimited: false, alerts: [] },
        maxIterations: 5,
        permissions: [],
        metadata: {},
      };

      const result = await svc.injectMemory('agent-1', ctx, 200);
      expect(result).toContain('[PERSONAL]');
    });

    it('should return empty string when no memory', async () => {
      mocks.memory.getContext.mockResolvedValueOnce('');

      const ctx: HermesExecutionContext = {
        sessionId: 'session-1',
        hermesAgentId: 'agent-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        threadId: 'thread-1',
        task: 'Test',
        systemPrompt: '',
        memoryContext: '',
        allowedTools: [],
        governanceContext: { requiresApproval: false, blockedRules: [], rateLimited: false, alerts: [] },
        maxIterations: 5,
        permissions: [],
        metadata: {},
      };

      const result = await svc.injectMemory('agent-1', ctx);
      expect(result).toBe('');
    });
  });

  describe('enrichWithGovernance', () => {
    it('should return governance context from governance service', async () => {
      mocks.governance.evaluate.mockResolvedValueOnce({
        requiresApproval: true,
        triggeredRules: ['HIGH_VALUE_PAYMENT'],
        actions: ['RATE_LIMIT'],
      });

      const ctx: HermesExecutionContext = {
        sessionId: 'session-1',
        hermesAgentId: 'agent-1',
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        threadId: 'thread-1',
        task: 'Pay $50,000 to vendor',
        systemPrompt: '',
        memoryContext: '',
        allowedTools: [],
        governanceContext: { requiresApproval: false, blockedRules: [], rateLimited: false, alerts: [] },
        maxIterations: 5,
        permissions: [],
        metadata: {},
      };

      const govCtx = await svc.enrichWithGovernance(ctx, 'tenant-1');

      expect(govCtx.requiresApproval).toBe(true);
      expect(govCtx.blockedRules).toContain('HIGH_VALUE_PAYMENT');
      expect(govCtx.rateLimited).toBe(true);
    });
  });
});
