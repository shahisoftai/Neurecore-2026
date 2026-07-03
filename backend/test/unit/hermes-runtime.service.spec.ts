import { HermesRuntimeService } from '../../src/modules/hermes/services/hermes-runtime.service';
import { HermesAgentType } from '@prisma/client';

function buildMocks() {
  const prisma: any = {
    hermesAgent: {
      findFirst: jest.fn(),
    },
    hermesAuditLog: {
      create: jest.fn(),
    },
  };

  const mockLLM: any = {
    invokeWithTools: jest.fn(),
  };

  const mockRegistry: any = {
    findById: jest.fn(),
    setStatus: jest.fn(),
    recordUsage: jest.fn(),
  };

  const mockSessions: any = {
    create: jest.fn(),
    updateStatus: jest.fn(),
    addMessage: jest.fn(),
    getConversationHistory: jest.fn(),
  };

  const mockContext: any = {
    buildExecutionContext: jest.fn(),
  };

  const mockMemory: any = {
    rememberEpisode: jest.fn(),
    store: jest.fn(),
    getContext: jest.fn(),
  };

  const mockEventBus: any = {
    emit: jest.fn(),
    subscribe: jest.fn(),
  };

  const mockToolGateway: any = {
    buildToolMenu: jest.fn(),
    execute: jest.fn(),
  };

  const mockEventsGateway: any = {
    emitToTenant: jest.fn(),
  };

  const mockTenantContext: any = {
    tenantId: 'tenant-1',
  };

  const svc = new HermesRuntimeService(
    prisma as any,
    mockLLM as any,
    mockRegistry as any,
    mockSessions as any,
    mockContext as any,
    mockMemory as any,
    mockEventBus as any,
    mockToolGateway as any,
    mockEventsGateway as any,
    mockTenantContext as any,
  );

  return {
    svc,
    mocks: {
      prisma,
      llm: mockLLM,
      registry: mockRegistry,
      sessions: mockSessions,
      context: mockContext,
      memory: mockMemory,
      eventBus: mockEventBus,
      toolGateway: mockToolGateway,
      eventsGateway: mockEventsGateway,
    },
  };
}

describe('HermesRuntimeService', () => {
  let svc: HermesRuntimeService;
  let mocks: ReturnType<typeof buildMocks>['mocks'];

  beforeEach(() => {
    const built = buildMocks();
    svc = built.svc;
    mocks = built.mocks;
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute a task via LLM and return result', async () => {
      mocks.prisma.hermesAgent.findFirst.mockResolvedValueOnce({
        id: 'agent-1',
        name: 'Test Agent',
        type: HermesAgentType.CUSTOM,
        tenantId: 'tenant-1',
        isActive: true,
      });

      mocks.registry.setStatus.mockResolvedValue(undefined);
      mocks.sessions.updateStatus.mockResolvedValue(undefined);
      mocks.sessions.getConversationHistory.mockResolvedValue([]);
      mocks.context.buildExecutionContext.mockResolvedValueOnce({
        systemPrompt: 'Test prompt',
        tools: { allowedTools: ['query'], deniedTools: [], toolsRequiringApproval: [], toolDefinitions: [] },
        memory: { personal: [], episodic: [], procedural: new Map() },
        config: {},
      });
      mocks.toolGateway.buildToolMenu.mockResolvedValueOnce([]);

      mocks.llm.invokeWithTools.mockResolvedValueOnce({
        content: 'Task completed successfully.',
        toolCalls: [],
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      });

      const result = await svc.execute({
        sessionId: 'session-1',
        hermesAgentId: 'agent-1',
        task: 'Test task',
        context: {
          tenantId: 'tenant-1',
          userId: 'user-1',
          threadId: 'thread-1',
        },
        maxIterations: 1,
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('Task completed successfully.');
      expect(result.tokensUsed.total).toBe(150);
      expect(mocks.eventBus.emit).toHaveBeenCalled();
      expect(mocks.eventsGateway.emitToTenant).toHaveBeenCalled();
    });

    it('should throw when agent not found', async () => {
      mocks.prisma.hermesAgent.findFirst.mockResolvedValueOnce(null);

      await expect(
        svc.execute({
          sessionId: 's1',
          hermesAgentId: 'nonexistent',
          task: 'test',
          context: {
            tenantId: 'tenant-1',
            userId: 'user-1',
            threadId: 't1',
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('createSession', () => {
    it('should create a session for active agent', async () => {
      mocks.prisma.hermesAgent.findFirst.mockResolvedValueOnce({
        id: 'agent-1',
        tenantId: 'tenant-1',
        isActive: true,
      });

      mocks.sessions.create.mockResolvedValueOnce({
        id: 'session-1',
        hermesAgentId: 'agent-1',
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

      const session = await svc.createSession('agent-1', 'user-1', 'tenant-1');
      expect(session).toBeDefined();
      expect(session.id).toBe('session-1');
      expect(session.hermesAgentId).toBe('agent-1');
    });
  });

  describe('suspend / resume', () => {
    it('should suspend an agent', async () => {
      mocks.prisma.hermesAgent.findFirst.mockResolvedValueOnce({
        id: 'agent-1',
        tenantId: 'tenant-1',
      });

      await svc.suspend('agent-1', 'tenant-1');
      expect(mocks.registry.setStatus).toHaveBeenCalledWith('agent-1', 'tenant-1', 'SUSPENDED');
    });

    it('should resume an agent', async () => {
      mocks.prisma.hermesAgent.findFirst.mockResolvedValueOnce({
        id: 'agent-1',
        tenantId: 'tenant-1',
      });

      await svc.resume('agent-1', 'tenant-1');
      expect(mocks.registry.setStatus).toHaveBeenCalledWith('agent-1', 'tenant-1', 'IDLE');
    });
  });

  describe('getStatus', () => {
    it('should return agent status', async () => {
      mocks.prisma.hermesAgent.findFirst.mockResolvedValueOnce({
        id: 'agent-1',
        status: 'IDLE',
      });

      const status = await svc.getStatus('agent-1', 'tenant-1');
      expect(status).toBe('IDLE');
    });
  });
});
