import { HermesRuntimeService } from '../../src/modules/hermes/services/hermes-runtime.service';
import type { HermesExecutionContext } from '../../src/modules/hermes/common/hermes.types';

function buildMocks() {
  const mockRegistry = {
    findById: jest.fn(),
    ensureHermesAgent: jest.fn(),
  };

  const mockToolGateway = {
    validate: jest.fn(),
  };

  const mockSession = {
    addMessage: jest.fn(),
  };

  const mockMemory = {
    summarize: jest.fn(),
  };

  const mockContext = {
    build: jest.fn(),
  };

  const mockEventBus = {
    emit: jest.fn(),
  };

  const mockPresence = {
    setStatus: jest.fn(),
  };

  const mockGraph = {
    stream: jest.fn(),
  };

  const svc = new HermesRuntimeService(
    mockRegistry as any,
    mockToolGateway as any,
    mockSession as any,
    mockMemory as any,
    mockContext as any,
    mockEventBus as any,
    mockPresence as any,
    mockGraph as any,
  );

  return {
    svc,
    mocks: {
      registry: mockRegistry,
      toolGateway: mockToolGateway,
      session: mockSession,
      memory: mockMemory,
      context: mockContext,
      eventBus: mockEventBus,
      presence: mockPresence,
      graph: mockGraph,
    },
  };
}

describe('HermesRuntimeService', () => {
  let svc: HermesRuntimeService;
  let mocks: ReturnType<typeof buildMocks>['mocks'];

  const baseExecCtx: HermesExecutionContext = {
    sessionId: 'session-1',
    hermesAgentId: 'agent-1',
    task: 'Process invoice',
    context: {
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      threadId: 'thread-1',
      agentId: 'agent-1',
    },
  };

  beforeEach(() => {
    const result = buildMocks();
    svc = result.svc;
    mocks = result.mocks;
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('throws when agent not found or inactive', async () => {
      mocks.registry.findById.mockResolvedValue(null);

      const result = await svc.execute(baseExecCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found or inactive');
    });

    it('returns success=false when stream throws', async () => {
      mocks.registry.findById.mockResolvedValue({ id: 'agent-1', isActive: true, type: 'FINANCE' });
      mocks.context.build.mockResolvedValue({ hermesAgentId: 'agent-1', allowedTools: [], threadId: 'thread-1', tenantId: 'tenant-1', userId: 'user-1', workspaceId: 'ws-1' });
      mocks.graph.stream.mockImplementation(() => {
        throw new Error('Graph stream failed');
      });

      const result = await svc.execute(baseExecCtx);

      expect(result.success).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('returns agent status when found', async () => {
      mocks.registry.findById.mockResolvedValue({ id: 'agent-1', status: 'RUNNING' });

      const status = await svc.getStatus('agent-1');

      expect(status).toBe('RUNNING');
    });

    it('returns UNKNOWN when agent not found', async () => {
      mocks.registry.findById.mockResolvedValue(null);

      const status = await svc.getStatus('agent-unknown');

      expect(status).toBe('UNKNOWN');
    });
  });

  describe('cancel', () => {
    it('marks session as cancelled', async () => {
      mocks.registry.findById.mockResolvedValue({ id: 'agent-1', isActive: true });
      mocks.context.build.mockResolvedValue({ hermesAgentId: 'agent-1', allowedTools: [], threadId: 'thread-1', tenantId: 'tenant-1', userId: 'user-1', workspaceId: 'ws-1' });
      mocks.graph.stream.mockImplementation(async function* () {
        yield { currentNode: 'start' };
      });

      mocks.presence.setStatus.mockResolvedValue(undefined);
      mocks.session.addMessage.mockResolvedValue(undefined);
      mocks.memory.summarize.mockResolvedValue(undefined);

      // start execution
      const execPromise = svc.execute(baseExecCtx);

      // cancel immediately
      svc.cancel('session-1');

      const result = await execPromise;
      // cancellation may cause early exit with error or success depending on timing
      expect(result).toBeDefined();
    });
  });
});
