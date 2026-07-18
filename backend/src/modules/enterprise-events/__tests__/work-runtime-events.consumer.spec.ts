/**
 * WorkRuntimeEventsConsumer — in-memory unit tests.
 *
 * Tests the typed Socket.IO event consumer:
 * 1. Registers for correct event types on bootstrap.
 * 2. Routes workrun lifecycle events → emitWorkflowStatusChanged.
 * 3. Routes step events → emitTaskStarted / emitTaskCompleted.
 * 4. Routes task.completed → emitTaskCompleted.
 * 5. Socket.IO errors are non-fatal (durable processing unaffected).
 */

import { WorkRuntimeEventsConsumer, WORK_RUNTIME_EVENTS_CONSUMER_ID } from '../consumers/work-runtime-events.consumer';

class FakeTransport {
  registeredConsumer: any = null;
  subscribe(consumer: any, eventTypes: string[]) {
    this.registeredConsumer = { consumer, eventTypes };
  }
  registerConsumer(registration: any) {
    this.registeredConsumer = registration;
  }
}

class FakeGateway {
  emitted: Array<{ event: string; data: any }> = [];
  emitToTenant(tenantId: string, event: string, data: any) {
    this.emitted.push({ event, data });
  }
  emitTaskStarted(tenantId: string, taskId: string, agentId: string) {
    this.emitted.push({ event: 'task:started', data: { tenantId, taskId, agentId } });
  }
  emitTaskCompleted(tenantId: string, taskId: string, agentId: string, success: boolean, error?: string) {
    this.emitted.push({ event: success ? 'task:completed' : 'task:failed', data: { tenantId, taskId, agentId, success, error } });
  }
}

function makeEvent(eventType: string, tenantId: string, payload: any): any {
  return { eventId: 'ev_' + Math.random(), eventType, version: 1, tenantId, actorId: 'system', payload, idempotencyKey: 'test', sourceModule: 'test' };
}

describe('WorkRuntimeEventsConsumer', () => {
  let consumer: WorkRuntimeEventsConsumer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let gateway: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let transport: any;

  beforeEach(() => {
    gateway = new FakeGateway();
    transport = new FakeTransport();
    consumer = new WorkRuntimeEventsConsumer(transport, gateway);
  });

  describe('registration', () => {
    it('registers for all work-runtime event types on bootstrap', () => {
      consumer.onApplicationBootstrap();
      expect(transport.registeredConsumer).not.toBeNull();
      expect(transport.registeredConsumer.consumerId).toBe(WORK_RUNTIME_EVENTS_CONSUMER_ID);
      expect(transport.registeredConsumer.eventTypes).toEqual(expect.arrayContaining([
        'enterprise.workrun.created',
        'enterprise.workrun.started',
        'enterprise.workrun.completed',
        'enterprise.workrun.failed',
        'enterprise.workrun.paused',
        'enterprise.workrun.resumed',
        'enterprise.workrun.cancelled',
        'enterprise.workrun.approval.requested',
        'enterprise.workrun.step.started',
        'enterprise.workrun.step.succeeded',
        'enterprise.workrun.step.failed',
        'enterprise.task.completed',
      ]));
    });
  });

  describe('workrun lifecycle → workflow:status_changed', () => {
    async function emitAndCapture(eventType: string, payload: any) {
      consumer.onApplicationBootstrap();
      const handler = transport.registeredConsumer.handler;
      await handler(makeEvent(eventType, 't1', payload));
      return gateway.emitted as Array<{ event: string; data: any }>;
    }

    it('enterprise.workrun.created → status CREATED', async () => {
      const emitted = await emitAndCapture('enterprise.workrun.created', { runId: 'r1', title: 'Test Run' });
      const statusEvent = emitted.find(e => e.event === 'workflow:status_changed');
      expect(statusEvent).toBeDefined();
      expect(statusEvent!.data.status).toBe('CREATED');
      expect(statusEvent!.data.workflowId).toBe('r1');
    });

    it('enterprise.workrun.started → status STARTED', async () => {
      const emitted = await emitAndCapture('enterprise.workrun.started', { runId: 'r1' });
      expect(emitted.find(e => e.data.status === 'STARTED')).toBeDefined();
    });

    it('enterprise.workrun.completed → status COMPLETED', async () => {
      const emitted = await emitAndCapture('enterprise.workrun.completed', { runId: 'r1' });
      expect(emitted.find(e => e.data.status === 'COMPLETED')).toBeDefined();
    });

    it('enterprise.workrun.failed includes error from reason field', async () => {
      const emitted = await emitAndCapture('enterprise.workrun.failed', { runId: 'r1', reason: 'Out of memory' });
      const statusEvent = emitted.find(e => e.event === 'workflow:status_changed');
      expect(statusEvent).toBeDefined();
      expect(statusEvent!.data.status).toBe('FAILED');
      expect(statusEvent!.data.error).toBe('Out of memory');
    });

    it('enterprise.workrun.paused → status PAUSED', async () => {
      const emitted = await emitAndCapture('enterprise.workrun.paused', { runId: 'r1' });
      expect(emitted.find(e => e.data.status === 'PAUSED')).toBeDefined();
    });

    it('enterprise.workrun.resumed → status RESUMED', async () => {
      const emitted = await emitAndCapture('enterprise.workrun.resumed', { runId: 'r1' });
      expect(emitted.find(e => e.data.status === 'RESUMED')).toBeDefined();
    });

    it('enterprise.workrun.cancelled → status CANCELLED', async () => {
      const emitted = await emitAndCapture('enterprise.workrun.cancelled', { runId: 'r1' });
      expect(emitted.find(e => e.data.status === 'CANCELLED')).toBeDefined();
    });

    it('enterprise.workrun.approval.requested → status AWAITING_APPROVAL', async () => {
      const emitted = await emitAndCapture('enterprise.workrun.approval.requested', { runId: 'r1', approvalId: 'a1' });
      const statusEvent = emitted.find(e => e.event === 'workflow:status_changed');
      expect(statusEvent).toBeDefined();
      expect(statusEvent!.data.status).toBe('AWAITING_APPROVAL');
      expect(statusEvent!.data.approvalId).toBe('a1');
    });
  });

  describe('step events → task:started / task:completed', () => {
    it('enterprise.workrun.step.started → task:started', async () => {
      consumer.onApplicationBootstrap();
      const handler = transport.registeredConsumer.handler;
      await handler(makeEvent('enterprise.workrun.step.started', 't1', { runId: 'r1', stepId: 's1', agentId: 'agent-1' }));
      const started = gateway.emitted.find(e => e.event === 'task:started');
      expect(started).toBeDefined();
      expect(started!.data.taskId).toBe('s1');
      expect(started!.data.agentId).toBe('agent-1');
    });

    it('enterprise.workrun.step.started defaults agentId to SYSTEM', async () => {
      consumer.onApplicationBootstrap();
      const handler = transport.registeredConsumer.handler;
      await handler(makeEvent('enterprise.workrun.step.started', 't1', { runId: 'r1', stepId: 's1' }));
      const started = gateway.emitted.find(e => e.event === 'task:started');
      expect(started).toBeDefined();
      expect(started!.data.agentId).toBe('SYSTEM');
    });

    it('enterprise.workrun.step.succeeded → task:completed success=true', async () => {
      consumer.onApplicationBootstrap();
      const handler = transport.registeredConsumer.handler;
      await handler(makeEvent('enterprise.workrun.step.succeeded', 't1', { runId: 'r1', stepId: 's1', agentId: 'agent-1' }));
      const completed = gateway.emitted.find(e => e.event === 'task:completed');
      expect(completed).toBeDefined();
      expect(completed!.data.success).toBe(true);
      expect(completed!.data.taskId).toBe('s1');
    });

    it('enterprise.workrun.step.failed → task:completed success=false with error', async () => {
      consumer.onApplicationBootstrap();
      const handler = transport.registeredConsumer.handler;
      await handler(makeEvent('enterprise.workrun.step.failed', 't1', { runId: 'r1', stepId: 's1', agentId: 'agent-1', error: 'Assertion failed' }));
      const failed = gateway.emitted.find(e => e.event === 'task:failed');
      expect(failed).toBeDefined();
      expect(failed!.data.success).toBe(false);
      expect(failed!.data.error).toBe('Assertion failed');
    });

    it('enterprise.task.completed → task:completed success=true', async () => {
      consumer.onApplicationBootstrap();
      const handler = transport.registeredConsumer.handler;
      await handler(makeEvent('enterprise.task.completed', 't1', { taskId: 't1', title: 'Do the thing', status: 'COMPLETED' }));
      const completed = gateway.emitted.find(e => e.event === 'task:completed');
      expect(completed).toBeDefined();
      expect(completed!.data.success).toBe(true);
      expect(completed!.data.taskId).toBe('t1');
    });
  });

  describe('Socket.IO errors are non-fatal', () => {
    it('emitToTenant failure does not throw', async () => {
      gateway.emitToTenant = () => { throw new Error('Socket.IO down'); };
      consumer.onApplicationBootstrap();
      const handler = transport.registeredConsumer.handler;
      // Should not throw
      await handler(makeEvent('enterprise.workrun.completed', 't1', { runId: 'r1' }));
      // Event was still processed (durable unaffected)
      expect(gateway.emitted.length).toBe(0); // but emit threw
    });

    it('emitTaskStarted failure does not throw', async () => {
      gateway.emitTaskStarted = () => { throw new Error('Socket.IO down'); };
      consumer.onApplicationBootstrap();
      const handler = transport.registeredConsumer.handler;
      await handler(makeEvent('enterprise.workrun.step.started', 't1', { runId: 'r1', stepId: 's1' }));
      // Should not throw — error is caught and logged
    });
  });
});
