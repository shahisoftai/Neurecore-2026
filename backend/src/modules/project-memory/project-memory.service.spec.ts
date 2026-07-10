/**
 * project-memory.service.spec.ts — Phase 5 unit tests
 *
 * Covers:
 *  - create delegates to repo
 *  - findById throws NotFoundException when missing
 *  - findAll delegates to repo
 *  - search returns [] for empty query (no repo call)
 *  - search trims and forwards
 *  - supersede delegates to repo (no hard delete)
 */

import { NotFoundException } from '@nestjs/common';
import { ProjectMemoryService } from './project-memory.service';
import type { IProjectMemoryRepository } from './interfaces/project-memory.interface';
import type { ProjectMemory } from './interfaces/project-memory.interface';

function makeService() {
  const repo: jest.Mocked<IProjectMemoryRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    supersede: jest.fn(),
    search: jest.fn(),
  } as unknown as jest.Mocked<IProjectMemoryRepository>;
  const service = new ProjectMemoryService(repo);
  return { service, repo };
}

const sampleMemory: ProjectMemory = {
  id: 'mem_1',
  projectId: 'proj_1',
  authorId: 'user_1',
  authorType: 'HUMAN' as const,
  category: 'NOTE' as const,
  content: 'test',
  sourceEntityType: null,
  sourceEntityId: null,
  isPinned: true,
  isAiGenerated: false,
  confidence: null,
  supersededBy: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ProjectMemoryService', () => {
  it('create delegates to repository', async () => {
    const { service, repo } = makeService();
    repo.create.mockResolvedValue(sampleMemory);
    const result = await service.create('tenant_1', {
      projectId: 'proj_1',
      content: 'Tax filing deadline is April 15',
    });
    expect(result).toEqual(sampleMemory);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'proj_1',
      content: 'Tax filing deadline is April 15',
    }));
  });

  it('findById returns the entry when present', async () => {
    const { service, repo } = makeService();
    repo.findById.mockResolvedValue(sampleMemory);
    const result = await service.findById('mem_1', 'tenant_1');
    expect(result).toEqual(sampleMemory);
  });

  it('findById throws NotFoundException when missing', async () => {
    const { service, repo } = makeService();
    repo.findById.mockResolvedValue(null);
    await expect(service.findById('mem_missing', 'tenant_1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findAll defaults to empty options and forwards tenantId', async () => {
    const { service, repo } = makeService();
    repo.findAll.mockResolvedValue({ data: [sampleMemory], total: 1 });
    const result = await service.findAll('tenant_1');
    expect(result.total).toBe(1);
    expect(repo.findAll).toHaveBeenCalledWith({}, 'tenant_1');
  });

  it('search returns [] for empty query without calling repo', async () => {
    const { service, repo } = makeService();
    const result = await service.search('proj_1', '   ', 'tenant_1');
    expect(result).toEqual([]);
    expect(repo.search).not.toHaveBeenCalled();
  });

  it('search trims query and forwards', async () => {
    const { service, repo } = makeService();
    repo.search.mockResolvedValue([sampleMemory]);
    const result = await service.search('proj_1', '  tax  ', 'tenant_1');
    expect(result).toEqual([sampleMemory]);
    expect(repo.search).toHaveBeenCalledWith('proj_1', 'tax', 'tenant_1');
  });

  it('supersede delegates to repo (no hard delete)', async () => {
    const { service, repo } = makeService();
    repo.supersede.mockResolvedValue(undefined);
    await service.supersede('mem_old', 'mem_new');
    expect(repo.supersede).toHaveBeenCalledWith('mem_old', 'mem_new');
  });
});
