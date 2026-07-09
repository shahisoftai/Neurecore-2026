/**
 * ProjectStages — Prisma Repository
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IProjectStageRepository,
  ProjectStage,
  CreateStageInput,
  UpdateStageInput,
} from '../interfaces/project-stage.interface';

@Injectable()
export class PrismaProjectStageRepository implements IProjectStageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForProject(projectId: string): Promise<ProjectStage[]> {
    const rows = await this.prisma.projectStage.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    return rows.map((r) => this.map(r));
  }

  async create(
    projectId: string,
    dto: CreateStageInput,
  ): Promise<ProjectStage> {
    const row = await this.prisma.projectStage.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description ?? null,
        order: dto.order,
        status: dto.status ?? 'NOT_STARTED',
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
    return this.map(row);
  }

  async createBulk(
    projectId: string,
    stages: CreateStageInput[],
  ): Promise<ProjectStage[]> {
    if (stages.length === 0) return [];
    const data = stages.map((s) => ({
      projectId,
      name: s.name,
      description: s.description ?? null,
      order: s.order,
      status: s.status ?? 'NOT_STARTED',
      startDate: s.startDate ? new Date(s.startDate) : null,
      endDate: s.endDate ? new Date(s.endDate) : null,
    }));
    const result = await this.prisma.projectStage.createMany({ data });
    if (result.count === 0) return [];
    return this.listForProject(projectId);
  }

  async update(
    projectId: string,
    stageId: string,
    dto: UpdateStageInput,
  ): Promise<ProjectStage> {
    // Defense-in-depth: scope the update so a stage id from another project
    // (or another tenant) cannot be mutated even if the service-layer check
    // is bypassed somehow.
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }
    const row = await this.prisma.projectStage.update({
      where: { id: stageId, projectId },
      data,
    });
    return this.map(row);
  }

  async delete(projectId: string, stageId: string): Promise<void> {
    await this.prisma.projectStage.delete({
      where: { id: stageId, projectId },
    });
  }

  async existsForProject(
    projectId: string,
    stageId: string,
  ): Promise<boolean> {
    const row = await this.prisma.projectStage.findFirst({
      where: { id: stageId, projectId },
      select: { id: true },
    });
    return !!row;
  }

  async reorder(
    projectId: string,
    orderedIds: string[],
  ): Promise<ProjectStage[]> {
    // Deduplicate (preserve first-seen order) so repeated ids don't get their
    // order overwritten by a later write in the same transaction.
    const seen = new Set<string>();
    const deduped = orderedIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < deduped.length; i++) {
        // Scoped update so a stray id from another project can't be reordered.
        await tx.projectStage.update({
          where: { id: deduped[i], projectId },
          data: { order: i },
        });
      }
    });
    return this.listForProject(projectId);
  }

  private map(row: Record<string, unknown>): ProjectStage {
    return {
      id: row.id as string,
      projectId: row.projectId as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      order: row.order as number,
      status: row.status as ProjectStage['status'],
      startDate: (row.startDate as Date | null) ?? null,
      endDate: (row.endDate as Date | null) ?? null,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }
}