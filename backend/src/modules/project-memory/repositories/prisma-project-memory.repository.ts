/**
 * project-memory module — Prisma Repository
 *
 * Phase 5: Append-only project memory.
 * No hard delete — entries are superseded.
 *
 * SOLID: Single Responsibility, Dependency Inversion.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import type {
  IProjectMemoryRepository,
  CreateMemoryInput,
  UpdateMemoryInput,
  ListMemoriesOptions,
  ProjectMemory,
} from '../interfaces/project-memory.interface';

@Injectable()
export class PrismaProjectMemoryRepository implements IProjectMemoryRepository {
  private readonly logger = new Logger(PrismaProjectMemoryRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateMemoryInput): Promise<ProjectMemory> {
    const entry = await this.prisma.projectMemory.create({
      data: {
        projectId: data.projectId,
        authorId: data.authorId ?? null,
        authorType: data.authorType ?? 'HUMAN',
        category: data.category ?? 'NOTE',
        content: data.content,
        sourceEntityType: data.sourceEntityType ?? null,
        sourceEntityId: data.sourceEntityId ?? null,
        isPinned: data.isPinned ?? false,
        isAiGenerated: data.isAiGenerated ?? false,
        supersededBy: null,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.map(entry);
  }

  async findById(id: string, tenantId: string): Promise<ProjectMemory | null> {
    const entry = await this.prisma.projectMemory.findFirst({
      where: { id, project: { tenantId } },
    });
    return entry ? this.map(entry) : null;
  }

  async findAll(
    options: ListMemoriesOptions,
    tenantId: string,
  ): Promise<{ data: ProjectMemory[]; total: number }> {
    const where: Record<string, unknown> = {
      project: { tenantId },
      supersededBy: null,
    };

    if (options.projectId) where.projectId = options.projectId;
    if (options.authorId) where.authorId = options.authorId;
    if (options.category) where.category = options.category;
    if (options.sourceEntityId) where.sourceEntityId = options.sourceEntityId;

    const page = options.page ?? 1;
    const limit = options.limit ?? 50;

    const [items, total] = await Promise.all([
      this.prisma.projectMemory.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.projectMemory.count({ where }),
    ]);

    return { data: items.map((e) => this.map(e)), total };
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateMemoryInput,
  ): Promise<ProjectMemory> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`ProjectMemory ${id} not found`);
    }

    const updateData: Record<string, unknown> = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
    if (data.supersededBy !== undefined) updateData.supersededBy = data.supersededBy;

    const updated = await this.prisma.projectMemory.update({
      where: { id },
      data: updateData as Prisma.ProjectMemoryUpdateInput,
    });
    return this.map(updated);
  }

  async supersede(id: string, supersededById: string): Promise<void> {
    await this.prisma.projectMemory.update({
      where: { id },
      data: { supersededBy: supersededById },
    });
    this.logger.debug(`Memory ${id} superseded by ${supersededById}`);
  }

  async search(projectId: string, query: string, tenantId: string): Promise<ProjectMemory[]> {
    // category is a typed enum — match by exact (case-insensitive) equality for known categories,
    // and fall back to ILIKE on content.
    const normalised = query.trim().toUpperCase();
    const knownCategories: ReadonlyArray<ProjectMemory['category']> = [
      'NOTE', 'INSIGHT', 'CONSTRAINT', 'RISK', 'OPPORTUNITY', 'LESSON',
    ];
    const isCategoryMatch = (knownCategories as readonly string[]).includes(normalised);

    const entries = await this.prisma.projectMemory.findMany({
      where: {
        projectId,
        project: { tenantId },
        supersededBy: null,
        OR: [
          { content: { contains: query, mode: 'insensitive' } },
          ...(isCategoryMatch
            ? [{ category: normalised as ProjectMemory['category'] }]
            : []),
        ],
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
    return entries.map((e) => this.map(e));
  }

  private map(raw: {
    id: string;
    projectId: string;
    authorId: string | null;
    authorType: string;
    category: string;
    content: string;
    sourceEntityType: string | null;
    sourceEntityId: string | null;
    isPinned: boolean;
    isAiGenerated: boolean;
    supersededBy: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectMemory {
    return {
      id: raw.id,
      projectId: raw.projectId,
      authorId: raw.authorId,
      authorType: raw.authorType as ProjectMemory['authorType'],
      category: raw.category as ProjectMemory['category'],
      content: raw.content,
      sourceEntityType: raw.sourceEntityType,
      sourceEntityId: raw.sourceEntityId,
      isPinned: raw.isPinned,
      isAiGenerated: raw.isAiGenerated,
      supersededBy: raw.supersededBy,
      metadata: raw.metadata as Record<string, unknown>,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
