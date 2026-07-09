/**
 * completeness.service.spec.ts — Phase 2B unit tests
 *
 * 5+ cases per §9.2.
 */

import { CompletenessService } from './completeness.service';
import type { ICompletenessRepository } from './interfaces/completeness.interface';

function makeService(): {
  service: CompletenessService;
  repo: jest.Mocked<ICompletenessRepository>;
} {
  const repo: jest.Mocked<ICompletenessRepository> = {
    upsert: jest.fn().mockImplementation(async (input) => ({
      id: 'row_1',
      ...input,
    })),
    findByEntity: jest.fn(),
  } as unknown as jest.Mocked<ICompletenessRepository>;
  const service = new CompletenessService(repo);
  return { service, repo };
}

describe('CompletenessService.computeSnapshot', () => {
  it('returns 100 / 0 required when no questions', () => {
    const { service } = makeService();
    const snap = service.computeSnapshot('PROJECT', 'p1', {
      questions: [],
      responses: [],
    });
    expect(snap.score).toBe(100);
    expect(snap.totalRequired).toBe(0);
    expect(snap.missing).toEqual([]);
  });

  it('counts required questions and missing[] when no answers', () => {
    const { service } = makeService();
    const snap = service.computeSnapshot('PROJECT', 'p1', {
      questions: [
        { id: 'a', label: 'A', required: true },
        { id: 'b', label: 'B', required: true },
      ],
      responses: [],
    });
    expect(snap.totalRequired).toBe(2);
    expect(snap.totalResolved).toBe(0);
    expect(snap.score).toBe(0);
    expect(snap.missing.map((m) => m.questionId)).toEqual(['a', 'b']);
    expect(snap.missing[0].whyMissing).toBe('NO_RESPONSE');
  });

  it('counts resolved when answer exists and meets skip threshold', () => {
    const { service } = makeService();
    const snap = service.computeSnapshot('PROJECT', 'p1', {
      questions: [
        { id: 'a', label: 'A', required: true, skipIfConfidenceGte: 80 },
      ],
      responses: [{ questionId: 'a', value: 'x', confidence: 90 }],
    });
    expect(snap.totalResolved).toBe(1);
    expect(snap.score).toBe(100);
  });

  it('marks BELOW_THRESHOLD when response exists but confidence too low', () => {
    const { service } = makeService();
    const snap = service.computeSnapshot('PROJECT', 'p1', {
      questions: [
        { id: 'a', label: 'A', required: true, skipIfConfidenceGte: 80 },
      ],
      responses: [{ questionId: 'a', value: 'x', confidence: 50 }],
    });
    expect(snap.totalResolved).toBe(0);
    expect(snap.missing[0].whyMissing).toBe('BELOW_THRESHOLD');
  });

  it('optional questions do not contribute to score', () => {
    const { service } = makeService();
    const snap = service.computeSnapshot('PROJECT', 'p1', {
      questions: [
        { id: 'a', label: 'A', required: false },
        { id: 'b', label: 'B', required: true },
      ],
      responses: [{ questionId: 'b', value: 'x', confidence: 100 }],
    });
    expect(snap.totalRequired).toBe(1);
    expect(snap.score).toBe(100);
  });

  it('ignores null/undefined/empty answers as missing', () => {
    const { service } = makeService();
    const snap = service.computeSnapshot('PROJECT', 'p1', {
      questions: [{ id: 'a', label: 'A', required: true }],
      responses: [
        { questionId: 'a', value: null, confidence: 100 },
        { questionId: 'a', value: '', confidence: 100 },
        { questionId: 'a', value: undefined, confidence: 100 },
      ],
    });
    expect(snap.totalResolved).toBe(0);
  });
});

describe('CompletenessService.recompute', () => {
  it('upserts the computed snapshot to the repository', async () => {
    const { service, repo } = makeService();
    await service.recompute('PROJECT', 'p1', {
      questions: [{ id: 'a', label: 'A', required: true }],
      responses: [{ questionId: 'a', value: 'x', confidence: 100 }],
    });
    expect(repo.upsert).toHaveBeenCalledTimes(1);
  });

  it('with no inputs writes an empty (score=100) snapshot', async () => {
    const { service, repo } = makeService();
    await service.recompute('PROJECT', 'p1');
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ score: 100, totalRequired: 0 }),
    );
  });
});

describe('CompletenessService.get', () => {
  it('returns null when no row exists', async () => {
    const { service } = makeService();
    const snap = await service.get('PROJECT', 'p1');
    expect(snap).toBeNull();
  });

  it('returns the snapshot without the row id', async () => {
    const { service, repo } = makeService();
    repo.findByEntity.mockResolvedValue({
      id: 'row_1',
      entityType: 'PROJECT',
      entityId: 'p1',
      score: 50,
      totalRequired: 2,
      totalResolved: 1,
      missing: [
        {
          questionId: 'a',
          label: 'A',
          whyMissing: 'NO_RESPONSE',
          confidence: 0,
          suggestSourceTypes: [],
        },
      ],
      lastAssessedAt: new Date(),
    });
    const snap = await service.get('PROJECT', 'p1');
    expect(snap).not.toBeNull();
    expect((snap as Record<string, unknown>).id).toBeUndefined();
    expect(snap?.score).toBe(50);
  });
});
