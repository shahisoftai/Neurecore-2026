/**
 * EnterpriseEventTransport — integration/unit tests (Phase 2 §16 + §17).
 *
 * Uses the in-memory FakePrisma so the full outbox→inbox→process→retry→
 * dead-letter→replay lifecycle is exercised deterministically. A controllable
 * clock drives lease expiry and backoff windows.
 */

import { EnterpriseEventTransport } from '../transport/enterprise-event-transport.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { FakePrisma } from '../testing/fake-prisma';
import type { PublishEventInput } from '../contracts/enterprise-event.interface';

function projectCreated(
  tenantId: string,
  key: string,
  extra: Record<string, unknown> = {},
): PublishEventInput {
  return {
    eventType: 'enterprise.project.created',
    tenantId,
    actorType: 'SYSTEM',
    idempotencyKey: key,
    sourceModule: 'projects',
    payload: { projectId: key, name: 'X', ...extra },
  };
}

// Task event reused by the deterministic consumer path.
function taskCompleted(
  tenantId: string,
  key: string,
  mode: string,
): PublishEventInput {
  return {
    eventType: 'enterprise.task.completed',
    tenantId,
    actorType: 'SYSTEM',
    idempotencyKey: key,
    sourceModule: 'orchestration',
    payload: { taskId: key, status: 'COMPLETED', mode },
  };
}

class Clock {
  t = new Date('2026-07-14T00:00:00Z').getTime();
  now = () => new Date(this.t);
  advance(ms: number) {
    this.t += ms;
  }
}

function makeTransport(prisma: FakePrisma, clock: Clock) {
  return new EnterpriseEventTransport(prisma as never, { now: clock.now });
}

describe('EnterpriseEventTransport', () => {
  it('persists an outbox event on publish', async () => {
    const prisma = new FakePrisma();
    const t = makeTransport(prisma, new Clock());
    const res = await t.publish(projectCreated('t1', 'p1'));
    expect(res.deduplicated).toBe(false);
    expect(prisma.enterpriseEventOutbox.count()).toBe(1);
    const row = prisma.enterpriseEventOutbox.rows[0];
    expect(row.status).toBe('PENDING');
    expect(row.correlationId).toBeTruthy(); // auto-generated
  });

  it('deduplicates on (tenantId, idempotencyKey)', async () => {
    const prisma = new FakePrisma();
    const t = makeTransport(prisma, new Clock());
    const a = await t.publish(projectCreated('t1', 'dup'));
    const b = await t.publish(projectCreated('t1', 'dup'));
    expect(b.deduplicated).toBe(true);
    expect(b.eventId).toBe(a.eventId);
    expect(prisma.enterpriseEventOutbox.count()).toBe(1);
  });

  it('rejects an unregistered event type before the outbox', async () => {
    const prisma = new FakePrisma();
    const t = makeTransport(prisma, new Clock());
    await expect(
      t.publish({ ...projectCreated('t1', 'x'), eventType: 'enterprise.nope' }),
    ).rejects.toThrow();
    expect(prisma.enterpriseEventOutbox.count()).toBe(0);
  });

  it('dispatches to inbox and processes to PROCESSED', async () => {
    const prisma = new FakePrisma();
    const clock = new Clock();
    const t = makeTransport(prisma, clock);
    const seen: string[] = [];
    t.registerConsumer({
      consumerId: 'c1',
      eventTypes: ['enterprise.project.created'],
      handler: (e) => {
        seen.push(e.eventId);
      },
    });
    await t.publish(projectCreated('t1', 'p1'));
    await t.tick();
    expect(seen.length).toBe(1);
    const inbox = prisma.enterpriseEventInbox.rows[0];
    expect(inbox.status).toBe('PROCESSED');
    expect(inbox.consumerId).toBe('c1');
  });

  it('retries a failing consumer then dead-letters after max retries', async () => {
    const prisma = new FakePrisma();
    const clock = new Clock();
    const t = makeTransport(prisma, clock);
    let attempts = 0;
    t.registerConsumer({
      consumerId: 'flaky',
      eventTypes: ['enterprise.project.created'],
      handler: () => {
        attempts++;
        throw new Error('always fails');
      },
    });
    await t.publish(projectCreated('t1', 'p1'));

    // attempt 1 (retryCount 0 → fails → retryCount 1, backoff 4^1=4s)
    await t.tick();
    expect(prisma.enterpriseEventInbox.rows[0].status).toBe('FAILED');
    // attempt 2 (needs 4s backoff)
    clock.advance(4100);
    await t.retryFailed();
    await t.processPending();
    // attempt 3 (retryCount 2 → fails → retryCount 3 >= MAX → dead-letter, backoff 16s)
    clock.advance(16100);
    await t.retryFailed();
    await t.processPending();
    const inbox = prisma.enterpriseEventInbox.rows[0];
    expect(inbox.status).toBe('DEAD_LETTER');
    expect(prisma.enterpriseEventDeadLetter.count()).toBe(1);
    expect(attempts).toBe(3);
  });

  it('succeeds after a transient failure (retry recovery)', async () => {
    const prisma = new FakePrisma();
    const clock = new Clock();
    const t = makeTransport(prisma, clock);
    let n = 0;
    t.registerConsumer({
      consumerId: 'recovers',
      eventTypes: ['enterprise.project.created'],
      handler: () => {
        n++;
        if (n < 2) throw new Error('transient');
      },
    });
    await t.publish(projectCreated('t1', 'p1'));
    await t.tick(); // fails once → FAILED (retryCount 1 → backoff 4s)
    clock.advance(4100);
    await t.retryFailed();
    await t.processPending(); // succeeds
    expect(prisma.enterpriseEventInbox.rows[0].status).toBe('PROCESSED');
    expect(n).toBe(2);
  });

  it('replays a dead-letter (tenant-scoped) and re-processes', async () => {
    const prisma = new FakePrisma();
    const clock = new Clock();
    const t = makeTransport(prisma, clock);
    let mode: 'fail' | 'ok' = 'fail';
    t.registerConsumer({
      consumerId: 'replayer',
      eventTypes: ['enterprise.project.created'],
      handler: () => {
        if (mode === 'fail') throw new Error('down');
      },
    });
    await t.publish(projectCreated('t1', 'p1'));
    // drive to dead-letter (backoffs: 4s after attempt1, 16s after attempt2)
    await t.tick();
    clock.advance(4100); await t.retryFailed(); await t.processPending();
    clock.advance(16100); await t.retryFailed(); await t.processPending();
    const dl = prisma.enterpriseEventDeadLetter.rows[0];
    expect(dl).toBeTruthy();

    // wrong tenant cannot replay
    expect(await t.replayDeadLetter(dl.id, 'other')).toBe(false);

    // correct tenant replays; now the dependency is healthy
    mode = 'ok';
    expect(await t.replayDeadLetter(dl.id, 't1')).toBe(true);
    await t.processPending();
    expect(prisma.enterpriseEventInbox.rows[0].status).toBe('PROCESSED');
    expect(dl.replayStatus).toBe('REPLAYED');
  });

  it('recovers a stale PROCESSING lease', async () => {
    const prisma = new FakePrisma();
    const clock = new Clock();
    const t = makeTransport(prisma, clock);
    // Register a consumer that "hangs" (never settles) on first pass by
    // simulating a crash: we manually claim then abandon.
    t.registerConsumer({
      consumerId: 'hang',
      eventTypes: ['enterprise.project.created'],
      handler: () => {
        /* settles fine on retry */
      },
    });
    await t.publish(projectCreated('t1', 'p1'));
    await t.dispatchPending();
    // Manually claim (simulate a worker that then crashes before settling).
    const inbox = prisma.enterpriseEventInbox.rows[0];
    await prisma.enterpriseEventInbox.updateMany({
      where: { id: inbox.id, status: 'PENDING' },
      data: {
        status: 'PROCESSING',
        leaseToken: 'stale',
        leaseExpiresAt: new Date(clock.t + 30_000),
        claimedAt: new Date(clock.t),
      },
    });
    // Before expiry: recovery does nothing.
    expect(await t.recoverStale()).toBe(0);
    // After lease expiry: recovered to FAILED.
    clock.advance(31_000);
    expect(await t.recoverStale()).toBe(1);
    expect(prisma.enterpriseEventInbox.rows[0].status).toBe('FAILED');
  });

  it('two workers cannot both claim the same inbox entry', async () => {
    const prisma = new FakePrisma();
    const clock = new Clock();
    const t = makeTransport(prisma, clock);
    t.registerConsumer({
      consumerId: 'c1',
      eventTypes: ['enterprise.project.created'],
      handler: () => {},
    });
    await t.publish(projectCreated('t1', 'p1'));
    await t.dispatchPending();
    const inboxId = prisma.enterpriseEventInbox.rows[0].id;
    // Two concurrent claims via the private atomic path (updateMany CAS).
    const c1 = await prisma.enterpriseEventInbox.updateMany({
      where: { id: inboxId, status: 'PENDING' },
      data: { status: 'PROCESSING', leaseToken: 'w1' },
    });
    const c2 = await prisma.enterpriseEventInbox.updateMany({
      where: { id: inboxId, status: 'PENDING' },
      data: { status: 'PROCESSING', leaseToken: 'w2' },
    });
    expect(c1.count).toBe(1);
    expect(c2.count).toBe(0); // second worker loses
  });

  it('isolates events by tenant', async () => {
    const prisma = new FakePrisma();
    const clock = new Clock();
    const t = makeTransport(prisma, clock);
    const byTenant: Record<string, number> = {};
    t.registerConsumer({
      consumerId: 'c1',
      eventTypes: ['enterprise.project.created'],
      handler: (e) => {
        byTenant[e.tenantId] = (byTenant[e.tenantId] ?? 0) + 1;
      },
    });
    await t.publish(projectCreated('t1', 'a'));
    await t.publish(projectCreated('t2', 'b'));
    await t.tick();
    expect(byTenant['t1']).toBe(1);
    expect(byTenant['t2']).toBe(1);
    // same idempotency key is allowed across DIFFERENT tenants
    await t.publish(projectCreated('t1', 'shared'));
    await t.publish(projectCreated('t2', 'shared'));
    expect(prisma.enterpriseEventOutbox.count()).toBe(4);
  });

  it('provides per-consumer observability counters', async () => {
    const prisma = new FakePrisma();
    const t = makeTransport(prisma, new Clock());
    t.registerConsumer({
      consumerId: 'c1',
      eventTypes: '*',
      handler: () => {},
    });
    await t.publish(projectCreated('t1', 'p1'));
    await t.tick();
    const status = await t.getConsumerStatus('c1');
    expect(status.processed).toBe(1);
    expect(status.pending).toBe(0);
  });

  it('business-effect idempotency prevents duplicate effects on re-delivery', async () => {
    const prisma = new FakePrisma();
    const clock = new Clock();
    const t = makeTransport(prisma, clock);
    const idem = new IdempotencyService(prisma as never);
    let effect = 0;
    t.registerConsumer({
      consumerId: 'counter',
      eventTypes: ['enterprise.task.completed'],
      handler: async (e) => {
        await idem.runOnce(e.idempotencyKey, 'counter', e.tenantId, async () => {
          effect++;
        });
      },
    });
    await t.publish(taskCompleted('t1', 'task-1', 'count'));
    await t.tick();
    // Force a re-delivery of the same event to the same consumer by resetting
    // its inbox row to PENDING (simulates at-least-once double delivery).
    await prisma.enterpriseEventInbox.updateMany({
      where: { consumerId: 'counter' },
      data: { status: 'PENDING' },
    });
    await t.processPending();
    expect(effect).toBe(1); // effect applied exactly once despite 2 deliveries
  });
});
