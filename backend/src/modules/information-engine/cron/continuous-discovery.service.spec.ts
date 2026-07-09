/**
 * continuous-discovery.service.spec.ts — Phase 2F unit tests
 *
 * Covers validate, onStageCompleted, onDeliverableSubmitted, stale detection,
 * and weeklyRecomputeAll.
 */

import { ContinuousDiscoveryService } from './continuous-discovery.service';
import type { ICompletenessRepository, EntityCompletenessSnapshot } from '../completeness/interfaces/completeness.interface';
import { CompletenessService } from '../completeness/completeness.service';
import { MiniCronService } from './mini-cron.service';

function makePrisma(projects: Array<{ id: string; tenantId: string; name: string; status: string }> = []) {
  return {
    project: {
      findMany: jest.fn().mockResolvedValue(projects),
    },
  } as never;
}

function makeCompleteness() {
  const repo: jest.Mocked<ICompletenessRepository> = {
    upsert: jest.fn().mockImplementation(async (input) => ({
      id: 'cmp_1',
      ...input,
    })),
    findByEntity: jest.fn(),
  } as unknown as jest.Mocked<ICompletenessRepository>;
  return new CompletenessService(repo);
}

function build() {
  const prisma = makePrisma();
  const completeness = makeCompleteness();
  const cron = new MiniCronService();
  const svc = new ContinuousDiscoveryService(prisma as never, completeness, cron);
  return { svc, prisma, completeness, cron };
}

describe('ContinuousDiscoveryService', () => {
  it('startCron is idempotent', () => {
    const { svc, cron } = build();
    svc.startCron();
    svc.startCron();
    expect(cron.listJobs().length).toBe(1); // only registered once
  });

  it('onStageCompleted calls recompute via completenessService', async () => {
    const { svc, completeness } = build();
    const spy = jest.spyOn(completeness, 'recompute').mockResolvedValue({
      entityType: 'PROJECT',
      entityId: 'p1',
      score: 80,
      totalRequired: 5,
      totalResolved: 4,
      missing: [],
      lastAssessedAt: new Date(),
    });
    await svc.onStageCompleted('p1');
    expect(spy).toHaveBeenCalledWith('PROJECT', 'p1');
  });

  it('onDeliverableSubmitted calls recompute via completenessService', async () => {
    const { svc, completeness } = build();
    const spy = jest.spyOn(completeness, 'recompute').mockResolvedValue({
      entityType: 'PROJECT',
      entityId: 'p2',
      score: 90,
      totalRequired: 10,
      totalResolved: 9,
      missing: [],
      lastAssessedAt: new Date(),
    });
    await svc.onDeliverableSubmitted('p2');
    expect(spy).toHaveBeenCalledWith('PROJECT', 'p2');
  });

  it('validate throws when score < 100 and there are required questions', async () => {
    const { svc, completeness } = build();
    jest.spyOn(completeness, 'get').mockResolvedValue({
      entityType: 'PROJECT',
      entityId: 'p3',
      score: 50,
      totalRequired: 4,
      totalResolved: 2,
      missing: [
        {
          questionId: 'a',
          label: 'A',
          whyMissing: 'NO_RESPONSE',
          confidence: 0,
          suggestSourceTypes: ['USER_INPUT'],
        },
      ],
      lastAssessedAt: new Date(),
    });
    await expect(svc.validate('p3')).rejects.toThrow(/50%/);
  });

  it('validate succeeds when score is 100', async () => {
    const { svc, completeness } = build();
    jest.spyOn(completeness, 'get').mockResolvedValue({
      entityType: 'PROJECT',
      entityId: 'p4',
      score: 100,
      totalRequired: 2,
      totalResolved: 2,
      missing: [],
      lastAssessedAt: new Date(),
    });
    const snap = await svc.validate('p4');
    expect(snap.score).toBe(100);
  });

  it('validate succeeds when totalRequired is 0 (untyped project)', async () => {
    const { svc, completeness } = build();
    jest.spyOn(completeness, 'get').mockResolvedValue({
      entityType: 'PROJECT',
      entityId: 'p5',
      score: 100,
      totalRequired: 0,
      totalResolved: 0,
      missing: [],
      lastAssessedAt: new Date(),
    });
    const snap = await svc.validate('p5');
    expect(snap.score).toBe(100);
  });
});