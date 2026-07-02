import { HermesRuntimeService } from '../../src/modules/hermes/services/hermes-runtime.service';
import type {
  HermesExecutionRequest,
  HermesExecutionContext,
  GovernanceContext,
} from '../../src/modules/hermes/interfaces/hermes-runtime.interface';

function buildMocks() {
  const mockRegistry = {
    findById: jest.fn(),
    updateStatus: jest.fn(),
    recordUsage: jest.fn(),
  };

  const mockSessions = {
    create: jest.fn(),
    findById: jest.fn(),
    addMessage: jest.fn(),
  };

  const mockMemory = {
    store: jest.fn(),
    getContext: jest.fn(),
  };

  const mockContextService = {
    build: jest.fn(),
  };

  const mockToolGateway = {
    validate: jest.fn(),
    execute: jest.fn(),
    getAllowedTools: jest.fn(),
  };

  const mockLlmFactory = {
    invokeWithTools: jest.fn(),
    selectModel: jest.fn(),
  };

  const svc = new HermesRuntimeService(
    mockRegistry as any,
    mockSessions as any,
    mockMemory as any,
    mockContextService as any,
    mockToolGateway as any,
    mockLlmFactory as any,
  );

  return {
    svc,
    mocks: {
      registry: mockRegistry,
      sessions: mockSessions,
      memory: mockMemory,
      contextService: mockContextService,
      toolGateway: mockToolGateway,
      llmFactory: mockLlmFactory,
    },
  };
}

describe('HermesRuntimeService', () => {
  let svc: HermesRuntimeService;
  let mocks: ReturnType<typeof buildMocks>['mocks'];

  const baseContext: HermesExecutionContext = {
    sessionId: 'session-1',
    hermesAgentId: 'agent-1',
    tenantId: 'tenant-1',
    workspaceId: 'ws-1',
    userId: 'user-1',
    threadId: 'thread-1',
    task: 'Process invoice #123',
    systemPrompt: 'You are a finance agent.',
    memoryContext: '',
    allowedTools: ['read_invoice', 'approve_invoice'],
    governanceContext: {
      requiresApproval: false,
      blockedRules: [],
      rateLimited: false,
      alerts: [],
    },
    maxIterations: 5,
    permissions: ['invoice:read', 'invoice:approve'],
    metadata: {},
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

  describe('execute', () => {
    it('should return governance block result when approval required', async () => {
      mocks.contextService.build.mockResolvedValueOnce({
        ...baseContext,
        governanceContext: { requiresApproval: true, blockedRules: ['HIGH_VALUE_TX'], rateLimited: false, alerts: ['HIGH_VALUE_TX'] },
      });

      const result = await svc.execute(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('GOVERNANCE_APPROVAL_REQUIRED');
      expect(mocks.llmFactory.invokeWithTools).not.toHaveBeenCalled();
    });

    it('should execute successfully with no tool calls', async () => {
      mocks.contextService.build.mockResolvedValueOnce(baseContext);
      mocks.sessions.addMessage.mockResolvedValueOnce(undefined);
      mocks.memory.getContext.mockResolvedValueOnce('');
      mocks.toolGateway.getAllowedTools.mockResolvedValueOnce(['read_invoice']);
      mocks.llmFactory.invokeWithTools.mockResolvedValueOnce({
        content: 'Invoice processed successfully',
        toolCalls: undefined,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      });
      mocks.memory.store.mockResolvedValueOnce({ id: 'mem-1' });

      const result = await svc.execute(baseRequest);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Invoice processed successfully');
      expect(mocks.sessions.addMessage).toHaveBeenCalled();
    });

    it('should execute tool calls and return results', async () => {
      mocks.contextService.build.mockResolvedValueOnce(baseContext);
      mocks.sessions.addMessage.mockResolvedValue(undefined);
      mocks.memory.getContext.mockResolvedValue('');
      mocks.toolGateway.getAllowedTools.mockResolvedValue(['read_invoice']);
      mocks.toolGateway.validate.mockResolvedValueOnce({ allowed: true, sanitizedInput: { invoiceId: '123' } });
      mocks.toolGateway.execute.mockResolvedValueOnce({ output: { success: true }, error: undefined });
      mocks.llmFactory.invokeWithTools
        .mockResolvedValueOnce({
          content: 'Found invoice, approving...',
          toolCalls: [{ name: 'approve_invoice', arguments: { invoiceId: '123' } }],
          usage: { totalTokens: 200 },
        })
        .mockResolvedValueOnce({
          content: 'Invoice approved',
          toolCalls: undefined,
          usage: { totalTokens: 100 },
        });
      mocks.memory.store.mockResolvedValue({ id: 'mem-1' });

      const result = await svc.execute(baseRequest);

      expect(result.success).toBe(true);
      expect(result.toolCalls.length).toBeGreaterThan(0);
      expect(result.toolCalls[0].tool).toBe('approve_invoice');
      expect(result.toolCalls[0].allowed).toBe(true);
    });

    it('should deny tool calls that fail validation', async () => {
      mocks.contextService.build.mockResolvedValueOnce(baseContext);
      mocks.sessions.addMessage.mockResolvedValue(undefined);
      mocks.memory.getContext.mockResolvedValue('');
      mocks.toolGateway.getAllowedTools.mockResolvedValue(['read_invoice']);
      mocks.toolGateway.validate.mockResolvedValueOnce({
        allowed: false,
        reason: 'Amount exceeds approval limit',
      });
      mocks.llmFactory.invokeWithTools
        .mockResolvedValueOnce({
          content: 'Attempting to approve...',
          toolCalls: [{ name: 'approve_invoice', arguments: { invoiceId: '123', amount: 50000 } }],
          usage: { totalTokens: 100 },
        })
        .mockResolvedValueOnce({
          content: 'Cannot approve high-value invoice',
          toolCalls: undefined,
          usage: { totalTokens: 50 },
        });
      mocks.memory.store.mockResolvedValue({ id: 'mem-1' });

      const result = await svc.execute(baseRequest);

      expect(result.toolCalls[0].allowed).toBe(false);
      expect(result.toolCalls[0].error).toBe('Amount exceeds approval limit');
    });

    it('should handle errors gracefully', async () => {
      mocks.contextService.build.mockRejectedValueOnce(new Error('Context build failed'));

      const result = await svc.execute(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Context build failed');
    });
  });

  describe('stream', () => {
    it('should yield governance error event when approval required', async () => {
      mocks.contextService.build.mockResolvedValueOnce({
        ...baseContext,
        governanceContext: { requiresApproval: true, blockedRules: ['HIGH_VALUE'], rateLimited: false, alerts: [] },
      });

      const events: any[] = [];
      for await (const event of svc.stream(baseRequest)) {
        events.push(event);
      }

      expect(events[0].type).toBe('error');
      expect(events[0].data.code).toBe('GOVERNANCE_APPROVAL_REQUIRED');
    });
  });

  describe('suspend / resume', () => {
    it('should update agent status to SUSPENDED', async () => {
      mocks.registry.updateStatus.mockResolvedValueOnce({});
      await svc.suspend('agent-1', 'tenant-1');
      expect(mocks.registry.updateStatus).toHaveBeenCalledWith('agent-1', 'SUSPENDED', 'tenant-1');
    });

    it('should update agent status to IDLE on resume', async () => {
      mocks.registry.updateStatus.mockResolvedValueOnce({});
      await svc.resume('agent-1', 'tenant-1');
      expect(mocks.registry.updateStatus).toHaveBeenCalledWith('agent-1', 'IDLE', 'tenant-1');
    });
  });

  describe('getStatus', () => {
    it('should return agent status', async () => {
      mocks.registry.findById.mockResolvedValueOnce({ id: 'agent-1', status: 'RUNNING' });
      const status = await svc.getStatus('agent-1', 'tenant-1');
      expect(status).toBe('RUNNING');
    });

    it('should throw NotFoundException when agent not found', async () => {
      mocks.registry.findById.mockResolvedValueOnce(null);
      await expect(svc.getStatus('agent-1', 'tenant-1')).rejects.toThrow();
    });
  });

  describe('createSession', () => {
    it('should create session for active agent', async () => {
      mocks.registry.findById.mockResolvedValueOnce({ id: 'agent-1', isActive: true, status: 'IDLE' });
      mocks.sessions.create.mockResolvedValueOnce({ id: 'session-1', hermesAgentId: 'agent-1' });

      const session = await svc.createSession('agent-1', 'user-1', 'tenant-1', 'ws-1');
      expect(session.id).toBe('session-1');
    });

    it('should throw when agent not found', async () => {
      mocks.registry.findById.mockResolvedValueOnce(null);
      await expect(svc.createSession('agent-1', 'user-1', 'tenant-1')).rejects.toThrow();
    });

    it('should throw when agent is not active', async () => {
      mocks.registry.findById.mockResolvedValueOnce({ id: 'agent-1', isActive: false });
      await expect(svc.createSession('agent-1', 'user-1', 'tenant-1')).rejects.toThrow();
    });
  });
});
