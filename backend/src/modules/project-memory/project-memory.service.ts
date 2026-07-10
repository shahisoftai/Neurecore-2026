/**
 * project-memory module — Service
 *
 * Phase 5: Project Memory
 * Append-only institutional knowledge — no hard delete.
 *
 * SOLID: Single Responsibility — owns memory lifecycle only.
 */

import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import type {
  IProjectMemoryRepository,
  CreateMemoryInput,
  UpdateMemoryInput,
  ListMemoriesOptions,
  ProjectMemory,
} from './interfaces/project-memory.interface';

export const PROJECT_MEMORY_REPOSITORY = 'PROJECT_MEMORY_REPOSITORY';
export const PROJECT_MEMORY_SERVICE = 'PROJECT_MEMORY_SERVICE';

@Injectable()
export class ProjectMemoryService {
  private readonly logger = new Logger(ProjectMemoryService.name);

  constructor(
    @Inject(PROJECT_MEMORY_REPOSITORY)
    private readonly repo: IProjectMemoryRepository,
  ) {}

  async create(tenantId: string, dto: CreateMemoryInput): Promise<ProjectMemory> {
    return this.repo.create(dto);
  }

  async findById(id: string, tenantId: string): Promise<ProjectMemory> {
    const entry = await this.repo.findById(id, tenantId);
    if (!entry) throw new NotFoundException(`ProjectMemory ${id} not found`);
    return entry;
  }

  async findAll(
    tenantId: string,
    options?: ListMemoriesOptions,
  ): Promise<{ data: ProjectMemory[]; total: number }> {
    return this.repo.findAll(options ?? {}, tenantId);
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateMemoryInput,
  ): Promise<ProjectMemory> {
    return this.repo.update(id, tenantId, dto);
  }

  async supersede(id: string, supersededById: string): Promise<void> {
    await this.repo.supersede(id, supersededById);
  }

  async search(projectId: string, query: string, tenantId: string): Promise<ProjectMemory[]> {
    if (!query.trim()) return [];
    return this.repo.search(projectId, query.trim(), tenantId);
  }

  async updateConfidence(
    id: string,
    tenantId: string,
    confidence: number,
    supersededById?: string | null,
  ): Promise<ProjectMemory> {
    return this.repo.updateConfidence(id, tenantId, confidence, supersededById);
  }
}
