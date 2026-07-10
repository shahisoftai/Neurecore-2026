/**
 * ProjectStages — Service
 *
 * SRP: handles stage CRUD. Project existence is validated via a small Prisma
 * check (kept inline to avoid circular module deps).
 * DIP: depends on IProjectStageRepository.
 *
 * Security note: every per-stage mutation (update/delete/reorder) verifies
 * the stage belongs to the named project. This is the tenant's last line of
 * defense against cross-project access if a stage id leaks across requests.
 */

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  IProjectStageRepository,
  ProjectStage,
  CreateStageInput,
  UpdateStageInput,
} from './interfaces/project-stage.interface';
import { PROJECT_STAGE_REPOSITORY } from './interfaces/project-stage.interface';
import type { ContinuousDiscoveryService } from '../information-engine/cron/continuous-discovery.service';

@Injectable()
export class ProjectStagesService {
  constructor(
    @Inject(PROJECT_STAGE_REPOSITORY)
    private readonly repository: IProjectStageRepository,
    private readonly prisma: PrismaService,
    @Optional()
    private readonly continuousDiscovery?: ContinuousDiscoveryService,
    @Optional()
    private readonly eventBus?: any,
  ) {}

  private async ensureProject(
    projectId: string,
    tenantId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
  }

  private async ensureStage(
    projectId: string,
    stageId: string,
  ): Promise<void> {
    const belongs = await this.repository.existsForProject(projectId, stageId);
    if (!belongs) {
      throw new NotFoundException(`Stage ${stageId} not found in project ${projectId}`);
    }
  }

  async list(projectId: string, tenantId: string): Promise<ProjectStage[]> {
    await this.ensureProject(projectId, tenantId);
    return this.repository.listForProject(projectId);
  }

  async create(
    projectId: string,
    tenantId: string,
    dto: CreateStageInput,
  ): Promise<ProjectStage> {
    await this.ensureProject(projectId, tenantId);
    if (dto.order == null || dto.order < 0) {
      throw new BadRequestException('order must be a non-negative integer');
    }
    return this.repository.create(projectId, dto);
  }

  async update(
    projectId: string,
    tenantId: string,
    stageId: string,
    dto: UpdateStageInput,
  ): Promise<ProjectStage> {
    await this.ensureProject(projectId, tenantId);
    await this.ensureStage(projectId, stageId);
    const updated = await this.repository.update(projectId, stageId, dto);

    // Phase 2F: trigger a recompute when a stage moves to COMPLETED.
    if (updated.status === 'COMPLETED' && this.continuousDiscovery) {
      void this.continuousDiscovery.onStageCompleted(projectId);
    }

    // Phase 3B: emit StageCompleted event for automation handlers
    if (updated.status === 'COMPLETED' && this.eventBus) {
      try {
        this.eventBus.publish({
          type: 'StageCompleted',
          projectId,
          tenantId,
          timestamp: new Date(),
          payload: { stageId: updated.id, stageName: updated.name },
        });
      } catch (err) { /* fire-and-forget */ }
    }

    return updated;
  }

  async delete(
    projectId: string,
    tenantId: string,
    stageId: string,
  ): Promise<void> {
    await this.ensureProject(projectId, tenantId);
    await this.ensureStage(projectId, stageId);
    return this.repository.delete(projectId, stageId);
  }

  async reorder(
    projectId: string,
    tenantId: string,
    orderedIds: string[],
  ): Promise<ProjectStage[]> {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new BadRequestException('orderedIds must be a non-empty array');
    }

    await this.ensureProject(projectId, tenantId);

    // Reject if orderedIds contains ids that don't belong to this project.
    const uniqueIds = Array.from(new Set(orderedIds));
    const existing = await this.prisma.projectStage.findMany({
      where: { projectId, id: { in: uniqueIds } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));
    const foreign = uniqueIds.filter((id) => !existingIds.has(id));
    if (foreign.length > 0) {
      throw new BadRequestException(
        `Stage(s) not found in project ${projectId}: ${foreign.join(', ')}`,
      );
    }

    return this.repository.reorder(projectId, orderedIds);
  }
}