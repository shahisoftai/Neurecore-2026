import { MissionFeedAiPrioritizer } from '../../src/modules/mission-feed/services/mission-feed-ai.prioritizer';
import type { MissionFeedItem } from '@prisma/client';

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
});
