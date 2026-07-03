import { HermesEventBusService } from '../../src/modules/hermes/services/hermes-event-bus.service';

describe('HermesEventBusService', () => {
  let svc: HermesEventBusService;

  beforeEach(() => {
    svc = new HermesEventBusService();
  });

  describe('emit', () => {
    it('should emit events to subscribers', () => {
      const handler = jest.fn();
      svc.subscribe(handler);

      svc.emit({
        type: 'hermes:start',
        hermesAgentId: 'agent-1',
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        payload: { task: 'test' },
        timestamp: new Date(),
        traceId: 'trace-1',
      });

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0];
      expect(event.type).toBe('hermes:start');
      expect(event.hermesAgentId).toBe('agent-1');
    });
  });

  describe('subscribe', () => {
    it('should return unsubscribe function', () => {
      const handler = jest.fn();
      const unsub = svc.subscribe(handler);

      svc.emit({
        type: 'hermes:start',
        hermesAgentId: 'a1',
        sessionId: 's1',
        tenantId: 't1',
        payload: {},
        timestamp: new Date(),
        traceId: 't',
      });

      expect(handler).toHaveBeenCalledTimes(1);

      unsub();

      svc.emit({
        type: 'hermes:start',
        hermesAgentId: 'a2',
        sessionId: 's2',
        tenantId: 't1',
        payload: {},
        timestamp: new Date(),
        traceId: 't2',
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeToType', () => {
    it('should only fire for matching event type', () => {
      const startHandler = jest.fn();
      const errorHandler = jest.fn();

      svc.subscribeToType('hermes:start', startHandler);
      svc.subscribeToType('hermes:error', errorHandler);

      svc.emit({
        type: 'hermes:start',
        hermesAgentId: 'a1',
        sessionId: 's1',
        tenantId: 't1',
        payload: {},
        timestamp: new Date(),
        traceId: 't',
      });

      expect(startHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('getEventsForSession', () => {
    it('should return event history for a session', () => {
      svc.emit({
        type: 'hermes:start',
        hermesAgentId: 'a1',
        sessionId: 'session-1',
        tenantId: 't1',
        payload: { step: 1 },
        timestamp: new Date(),
        traceId: 't1',
      });

      svc.emit({
        type: 'hermes:end',
        hermesAgentId: 'a1',
        sessionId: 'session-1',
        tenantId: 't1',
        payload: { step: 2 },
        timestamp: new Date(),
        traceId: 't2',
      });

      const events = svc.getEventsForSession('session-1');
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('hermes:start');
      expect(events[1].type).toBe('hermes:end');
    });

    it('should return empty array for unknown session', () => {
      const events = svc.getEventsForSession('nonexistent');
      expect(events).toEqual([]);
    });
  });

  describe('linkToLangGraph', () => {
    it('should track linked threads', () => {
      svc.linkToLangGraph('thread-1');
      svc.linkToLangGraph('thread-2');
    });
  });
});
