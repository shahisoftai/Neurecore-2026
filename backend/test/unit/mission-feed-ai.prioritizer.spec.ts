import { MissionFeedAiPrioritizer } from '../../src/modules/mission-feed/services/mission-feed-ai.prioritizer';
import type { MissionFeedItem } from '@prisma/client';
import { MissionFeedCategory } from '@prisma/client';

/**
 * Unit tests for MissionFeedAiPrioritizer.scoreItem — Phase 5, Task 5.11.
 *
 * The DB-touching `tick()` is covered indirectly; `scoreItem` is pure
 * and deterministic, so we exercise it directly here.
 */

function makeItem(partial: Partial<MissionFeedItem>): MissionFeedItem {
  const base: Partial<MissionFeedItem> = {
    id: 'i1',
    tenantId: 't',
    userId: null,
    category: 'AI_INSIGHT',
    priority: 'MEDIUM',
    title: 't',
    description: null,
    entityType: null,
    entityId: null,
    actionPayload: {},
    dismissedAt: null,
    confidence: 0.5,
    sourceEventId: null,
    detectedAt: new Date(),
    createdAt: new Date(),
  };
  return { ...(base as MissionFeedItem), ...partial };
}

describe('MissionFeedAiPrioritizer.scoreItem', () => {
  let svc: MissionFeedAiPrioritizer;
  beforeAll(() => {
    // Construct without hitting DB by passing undefined-y stubs.
    svc = new MissionFeedAiPrioritizer(
      {} as never,
      {} as never,
      { get: () => undefined } as never,
    );
  });

  it('scores COST_ALERT higher than SYSTEM', () => {
    const cost = svc.scoreItem(makeItem({ category: 'COST_ALERT' }));
    const sys = svc.scoreItem(makeItem({ category: 'SYSTEM' }));
    expect(cost.total).toBeGreaterThan(sys.total);
  });

  it('recency boost: a fresh item scores higher than an old one', () => {
    const fresh = svc.scoreItem(makeItem({ detectedAt: new Date() }));
    const old = svc.scoreItem(
      makeItem({ detectedAt: new Date(Date.now() - 24 * 3600 * 1000) }),
    );
    expect(fresh.total).toBeGreaterThan(old.total);
  });

  it('operational entity types get a small bump', () => {
    const task = svc.scoreItem(makeItem({ entityType: 'TASK' }));
    const null_ = svc.scoreItem(makeItem({ entityType: null }));
    expect(task.total).toBeGreaterThan(null_.total);
  });

  it('score is clamped to [0, 1]', () => {
    const s = svc.scoreItem(
      makeItem({
        category: 'COST_ALERT',
        entityType: 'TASK',
        detectedAt: new Date(),
      }),
    );
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(1);
  });

  it('handles unknown category gracefully (FIX-007 enum-drift defensive)', () => {
    // Simulates a future enum value that the deployed Prisma client
    // doesn't know about (e.g. ONBOARDING_TASK on a stale client).
    // scoreItem must not throw — falls back to 0.5 weight.
    const s = svc.scoreItem(
      makeItem({
        // Cast through unknown because the test fixture type narrows
        // category to the client's known enum set.
        category: 'UNKNOWN_CATEGORY' as unknown as MissionFeedItem['category'],
      }),
    );
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(1);
  });
});

describe('MissionFeedAiPrioritizer.scoreTenant defensive (FIX-007)', () => {
  it('findMany error does not crash tick(); returns 0 updates', async () => {
    const prisma = {
      missionFeedItem: {
        findMany: jest.fn().mockRejectedValue(
          new Error(
            "Invalid `prisma.missionFeedItem.findMany()` invocation: Value 'ONBOARDING_TASK' not found in enum 'MissionFeedCategory'",
          ),
        ),
      },
      tenant: { findMany: jest.fn().mockResolvedValue([{ id: 't1' }]) },
    } as never;
    const events = { emitToTenant: jest.fn() } as never;
    const config = { get: () => undefined } as never;
    const svc = new MissionFeedAiPrioritizer(prisma, events, config);

    const updated = await (svc as unknown as {
      scoreTenant: (id: string) => Promise<number>;
    }).scoreTenant('t1');
    expect(updated).toBe(0);
  });

  it('filters by known categories to avoid enum-drift findMany failure', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      missionFeedItem: { findMany },
      tenant: { findMany: jest.fn().mockResolvedValue([{ id: 't1' }]) },
    } as never;
    const events = { emitToTenant: jest.fn() } as never;
    const config = { get: () => undefined } as never;
    const svc = new MissionFeedAiPrioritizer(prisma, events, config);
    await (svc as unknown as {
      scoreTenant: (id: string) => Promise<number>;
    }).scoreTenant('t1');
    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0];
    expect(args.where.category).toBeDefined();
    expect(args.where.category.in).toEqual(expect.arrayContaining(['COST_ALERT']));
    // Sanity: ONBOARDING_TASK is in the deployed schema (local) and should be filtered.
    expect(args.where.category.in).toEqual(
      expect.arrayContaining([MissionFeedCategory.ONBOARDING_TASK]),
    );
  });
});
