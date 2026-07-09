/**
 * project-type-packs.service.spec.ts — Phase 2B unit tests
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectTypePacksService } from './project-type-packs.service';
import type { IProjectTypePackRepository } from './interfaces/project-type-pack.interface';
import { QuestionPackService } from '../packs/question-packs.service';

function makeService(opts: { failFindPack?: boolean } = {}): {
  service: ProjectTypePacksService;
  repo: jest.Mocked<IProjectTypePackRepository>;
  questionPackService: jest.Mocked<QuestionPackService>;
} {
  const repo: jest.Mocked<IProjectTypePackRepository> = {
    listForProjectType: jest.fn(),
    replaceForProjectType: jest.fn().mockImplementation(async (id, links) =>
      links.map((l, idx) => ({
        projectTypeId: id,
        questionPackId: l.questionPackId,
        sortOrder: l.sortOrder ?? idx,
        questionPack: {
          id: l.questionPackId,
          key: `k${idx}`,
          name: `Pack ${idx}`,
          description: null,
          questions: [],
          version: 1,
          isSystem: false,
        },
      })),
    ),
  } as unknown as jest.Mocked<IProjectTypePackRepository>;

  const questionPackService = {
    findPack: opts.failFindPack
      ? jest.fn().mockRejectedValue(new NotFoundException('not found'))
      : jest.fn().mockImplementation(async (id: string) => ({
          id,
          key: 'k',
          name: 'Pack',
          description: null,
          version: 1,
          isSystem: false,
          questions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
  } as unknown as jest.Mocked<QuestionPackService>;

  return {
    service: new ProjectTypePacksService(repo, questionPackService),
    repo,
    questionPackService,
  };
}

describe('ProjectTypePacksService.replaceForProjectType', () => {
  it('rejects duplicate packIds', async () => {
    const { service } = makeService();
    await expect(
      service.replaceForProjectType('pt_1', ['p1', 'p1']),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects if any pack does not exist', async () => {
    const { service } = makeService({ failFindPack: true });
    await expect(service.replaceForProjectType('pt_1', ['p1'])).rejects.toThrow(
      NotFoundException,
    );
  });

  it('replaces links in given order', async () => {
    const { service, repo } = makeService();
    const r = await service.replaceForProjectType('pt_1', ['p1', 'p2']);
    expect(repo.replaceForProjectType).toHaveBeenCalledWith('pt_1', [
      { questionPackId: 'p1', sortOrder: 0 },
      { questionPackId: 'p2', sortOrder: 1 },
    ]);
    expect(r).toHaveLength(2);
  });
});

describe('ProjectTypePacksService.listForProjectType', () => {
  it('delegates to repo', async () => {
    const { service, repo } = makeService();
    repo.listForProjectType.mockResolvedValue([]);
    const r = await service.listForProjectType('pt_1');
    expect(r).toEqual([]);
  });
});
