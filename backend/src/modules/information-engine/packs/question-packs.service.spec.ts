/**
 * question-packs.service.spec.ts — Phase 2B unit tests
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuestionPackService } from './question-packs.service';
import type { IQuestionPackRepository } from './interfaces/question-pack.interface';

function makeService(): {
  service: QuestionPackService;
  repo: jest.Mocked<IQuestionPackRepository>;
} {
  const repo: jest.Mocked<IQuestionPackRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByKey: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<IQuestionPackRepository>;
  return { service: new QuestionPackService(repo), repo };
}

const validQuestions = [
  { id: 'a', label: 'A', type: 'TEXT' as const, required: true },
];

describe('QuestionPackService.createPack', () => {
  it('rejects empty key', async () => {
    const { service } = makeService();
    await expect(
      service.createPack({ key: '', name: 'X', questions: validQuestions }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects malformed questions', async () => {
    const { service } = makeService();
    await expect(
      service.createPack({
        key: 'k',
        name: 'X',
        questions: [{ id: 'x' }] as never,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate key', async () => {
    const { service, repo } = makeService();
    repo.findByKey.mockResolvedValue({
      id: 'p1',
      key: 'k',
      name: 'X',
      description: null,
      version: 1,
      isSystem: false,
      questions: validQuestions,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      service.createPack({ key: 'k', name: 'X', questions: validQuestions }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates when key + questions valid', async () => {
    const { service, repo } = makeService();
    repo.findByKey.mockResolvedValue(null);
    repo.create.mockResolvedValue({
      id: 'p1',
      key: 'k',
      name: 'X',
      description: null,
      version: 1,
      isSystem: false,
      questions: validQuestions,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const r = await service.createPack({
      key: 'k',
      name: 'X',
      questions: validQuestions,
    });
    expect(r.id).toBe('p1');
  });
});

describe('QuestionPackService.findPack', () => {
  it('throws NotFound when missing', async () => {
    const { service, repo } = makeService();
    repo.findById.mockResolvedValue(null);
    await expect(service.findPack('x')).rejects.toThrow(NotFoundException);
  });
});

describe('QuestionPackService.deletePack', () => {
  it('blocks deletion of system packs', async () => {
    const { service, repo } = makeService();
    repo.findById.mockResolvedValue({
      id: 'p1',
      key: 'core',
      name: 'Core',
      description: null,
      version: 1,
      isSystem: true,
      questions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(service.deletePack('p1')).rejects.toThrow(BadRequestException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes non-system packs', async () => {
    const { service, repo } = makeService();
    repo.findById.mockResolvedValue({
      id: 'p1',
      key: 'custom',
      name: 'Custom',
      description: null,
      version: 1,
      isSystem: false,
      questions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await service.deletePack('p1');
    expect(repo.delete).toHaveBeenCalledWith('p1');
  });
});
