import { HermesEventBusService } from '../../src/modules/hermes/services/hermes-event-bus.service';

function buildMocks() {
  const mockEvents = {
    emitToTenant: jest.fn(),
  };

  const svc = new HermesEventBusService(mockEvents as any);
  return { svc, events: mockEvents };
}

describe('HermesEventBusService', () => {
  let svc: HermesEventBusService;
  let events: ReturnType<typeof buildMocks>['events'];

  beforeEach(() => {
    const { svc: service, events: ev } = buildMocks();
    svc = service;
    events = ev;
    jest.clearAllMocks();
  });

  describe('emit', () => {
    it('should emit event to EventsGateway and call handlers', async () => {
      const handler = jest.fn();
      svc.on('hermes.task.completed', handler);

      await svc.emit({
        type: 'hermes.task.completed',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        data: { output: 'result', durationMs: 1000 },
        timestamp: new Date(),
      });

      expect(events.emitToTenant).toHaveBeenCalledWith(
        'tenant-1',
        'hermes:hermes.task.completed',
        expect.objectContaining({ type: 'hermes.task.completed' }),
      );
      expect(handler).toHaveBeenCalled();
    });

    it('should catch handler errors without failing emit', async () => {
      const badHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const goodHandler = jest.fn();
      svc.on('hermes.task.completed', badHandler);
      svc.on('hermes.task.completed', goodHandler);

      await svc.emit({
        type: 'hermes.task.completed',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        data: {},
        timestamp: new Date(),
      });

      expect(goodHandler).toHaveBeenCalled();
      expect(badHandler).toHaveBeenCalled();
    });
  });

  describe('on/off', () => {
    it('should register and call handler', async () => {
      const handler = jest.fn();
      svc.on('hermes.session.created', handler);

      await svc.emit({
        type: 'hermes.session.created',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        data: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should remove handler with off()', async () => {
      const handler = jest.fn();
      svc.on('hermes.session.created', handler);
      svc.off('hermes.session.created', handler);

      await svc.emit({
        type: 'hermes.session.created',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        data: {},
        timestamp: new Date(),
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('LangGraph callbacks', () => {
    it('should register and call LangGraph resume callback', async () => {
      const callback = jest.fn();
      svc.registerLangGraphResumeCallback('wf-1', callback);

      await svc.notifyLangGraphResume('wf-1', 'APPROVED');

      expect(callback).toHaveBeenCalledWith('APPROVED');
    });

    it('should unregister callback after notify', async () => {
      const callback = jest.fn();
      svc.registerLangGraphResumeCallback('wf-1', callback);

      await svc.notifyLangGraphResume('wf-1', 'APPROVED');
      await svc.notifyLangGraphResume('wf-1', 'REJECTED');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should silently ignore unknown workflowId', () => {
      expect(() => svc.notifyLangGraphResume('unknown-wf', 'APPROVED')).not.toThrow();
    });
  });

  describe('convenience methods', () => {
    it('should emitSessionCreated', async () => {
      await svc.emitSessionCreated('tenant-1', 'agent-1', 'session-1', 'thread-1');

      expect(events.emitToTenant).toHaveBeenCalledWith(
        'tenant-1',
        'hermes:hermes.session.created',
        expect.objectContaining({ type: 'hermes.session.created' }),
      );
    });

    it('should emitTaskStarted', async () => {
      await svc.emitTaskStarted('tenant-1', 'agent-1', 'session-1', 'Process invoice');

      expect(events.emitToTenant).toHaveBeenCalledWith(
        'tenant-1',
        'hermes:hermes.task.started',
        expect.objectContaining({ type: 'hermes.task.started' }),
      );
    });

    it('should emitTaskCompleted', async () => {
      await svc.emitTaskCompleted('tenant-1', 'agent-1', 'session-1', 'Done', 1500);

      expect(events.emitToTenant).toHaveBeenCalledWith(
        'tenant-1',
        'hermes:hermes.task.completed',
        expect.objectContaining({ type: 'hermes.task.completed' }),
      );
    });

    it('should emitTaskFailed', async () => {
      await svc.emitTaskFailed('tenant-1', 'agent-1', 'session-1', 'Connection timeout');

      expect(events.emitToTenant).toHaveBeenCalledWith(
        'tenant-1',
        'hermes:hermes.task.failed',
        expect.objectContaining({ type: 'hermes.task.failed' }),
      );
    });

    it('should emitApprovalRequested', async () => {
      await svc.emitApprovalRequested('tenant-1', 'agent-1', 'wf-123', { invoiceId: 'inv-1' });

      expect(events.emitToTenant).toHaveBeenCalledWith(
        'tenant-1',
        'hermes:hermes.approval.requested',
        expect.objectContaining({ type: 'hermes.approval.requested' }),
      );
    });

    it('should emitApprovalDecided', async () => {
      await svc.emitApprovalDecided('tenant-1', 'agent-1', 'wf-123', 'APPROVED', 'manager-1');

      expect(events.emitToTenant).toHaveBeenCalledWith(
        'tenant-1',
        'hermes:hermes.approval.decided',
        expect.objectContaining({ type: 'hermes.approval.decided' }),
      );
    });
  });
});
