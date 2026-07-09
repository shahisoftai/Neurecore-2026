/**
 * response.service.spec.ts — Phase 2B unit tests
 *
 * 4+ cases per §9.2 (record including supersede pattern).
 */

import { ResponseService } from './response.service';
import type { IResponseRepository } from './interfaces/response.interface';
import { SourceService } from '../sources/source.service';

function makeService(): {
  service: ResponseService;
  repo: jest.Mocked<IResponseRepository>;
  sourceService: jest.Mocked<SourceService>;
} {
  const repo: jest.Mocked<IResponseRepository> = {
    findCurrentByEntityAndQuestion: jest.fn(),
    create: jest.fn(),
    markSuperseded: jest.fn(),
    listCurrent: jest.fn(),
    listHistory: jest.fn(),
  } as unknown as jest.Mocked<IResponseRepository>;

  const sourceService = {
    create: jest.fn().mockImplementation(async (input) => ({
      id: 'src_1',
      type: input.type,
      label: input.label,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      confidence: input.confidence,
      verified: false,
      verifiedBy: null,
      verifiedAt: null,
      createdAt: new Date(),
    })),
    verify: jest.fn().mockResolvedValue({} as never),
  } as unknown as jest.Mocked<SourceService>;

  const service = new ResponseService(repo, sourceService as SourceService);
  return { service, repo, sourceService };
}

describe('ResponseService.record', () => {
  it('creates an InformationSource then an InformationResponse', async () => {
    const { service, repo, sourceService } = makeService();
    repo.create.mockResolvedValue({
      id: 'r1',
      entityType: 'PROJECT',
      entityId: 'p1',
      questionId: 'a',
      value: 'x',
      sourceId: 'src_1',
      confidence: 100,
      supersededById: null,
      createdAt: new Date(),
    });
    repo.findCurrentByEntityAndQuestion.mockResolvedValue(null);

    const r = await service.record('PROJECT', 'p1', {
      questionId: 'a',
      value: 'x',
      sourceType: 'USER_INPUT',
      sourceLabel: 'manual',
      confidence: 100,
    });

    expect(sourceService.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.markSuperseded).not.toHaveBeenCalled();
    expect(r.id).toBe('r1');
  });

  it('supersedes the previous current response', async () => {
    const { service, repo } = makeService();
    repo.findCurrentByEntityAndQuestion.mockResolvedValue({
      id: 'old',
      entityType: 'PROJECT',
      entityId: 'p1',
      questionId: 'a',
      value: 'old',
      sourceId: 'src_old',
      confidence: 100,
      supersededById: null,
      createdAt: new Date(),
    });
    repo.create.mockResolvedValue({
      id: 'new',
      entityType: 'PROJECT',
      entityId: 'p1',
      questionId: 'a',
      value: 'new',
      sourceId: 'src_new',
      confidence: 100,
      supersededById: null,
      createdAt: new Date(),
    });

    await service.record('PROJECT', 'p1', {
      questionId: 'a',
      value: 'new',
      sourceType: 'USER_INPUT',
      sourceLabel: 'manual',
    });

    expect(repo.markSuperseded).toHaveBeenCalledWith('old', 'new');
  });

  it('does NOT supersede when skipSupersede=true', async () => {
    const { service, repo } = makeService();
    repo.findCurrentByEntityAndQuestion.mockResolvedValue({
      id: 'old',
      entityType: 'PROJECT',
      entityId: 'p1',
      questionId: 'a',
      value: 'old',
      sourceId: 'src_old',
      confidence: 100,
      supersededById: null,
      createdAt: new Date(),
    });
    repo.create.mockResolvedValue({
      id: 'new',
      entityType: 'PROJECT',
      entityId: 'p1',
      questionId: 'a',
      value: 'new',
      sourceId: 'src_new',
      confidence: 100,
      supersededById: null,
      createdAt: new Date(),
    });

    await service.record('PROJECT', 'p1', {
      questionId: 'a',
      value: 'new',
      sourceType: 'SYSTEM',
      sourceLabel: 'seed',
      skipSupersede: true,
    });

    expect(repo.markSuperseded).not.toHaveBeenCalled();
  });

  it('clamps confidence to [0,100]', async () => {
    const { service, repo, sourceService } = makeService();
    repo.create.mockResolvedValue({
      id: 'r',
      entityType: 'PROJECT',
      entityId: 'p1',
      questionId: 'a',
      value: 'x',
      sourceId: 'src_1',
      confidence: 100,
      supersededById: null,
      createdAt: new Date(),
    });
    repo.findCurrentByEntityAndQuestion.mockResolvedValue(null);

    await service.record('PROJECT', 'p1', {
      questionId: 'a',
      value: 'x',
      sourceType: 'USER_INPUT',
      sourceLabel: 'manual',
      confidence: 999,
    });
    expect(sourceService.create).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 100 }),
      expect.any(String),
    );

    await service.record('PROJECT', 'p1', {
      questionId: 'a',
      value: 'x',
      sourceType: 'USER_INPUT',
      sourceLabel: 'manual',
      confidence: -10,
    });
    expect(sourceService.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ confidence: 0 }),
      expect.any(String),
    );
  });

  it('throws when questionId is empty', async () => {
    const { service } = makeService();
    await expect(
      service.record('PROJECT', 'p1', {
        questionId: '',
        value: 'x',
        sourceType: 'USER_INPUT',
        sourceLabel: 'manual',
      }),
    ).rejects.toThrow();
  });
});

describe('ResponseService.listCurrent / listHistory', () => {
  it('listCurrent delegates to repo', async () => {
    const { service, repo } = makeService();
    repo.listCurrent.mockResolvedValue([]);
    const r = await service.listCurrent('PROJECT', 'p1');
    expect(r).toEqual([]);
  });

  it('listHistory delegates to repo', async () => {
    const { service, repo } = makeService();
    repo.listHistory.mockResolvedValue([]);
    const r = await service.listHistory('PROJECT', 'p1', 'a');
    expect(r).toEqual([]);
  });
});
