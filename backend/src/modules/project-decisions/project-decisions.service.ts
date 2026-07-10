/**
 * project-decisions module — Service
 *
 * Phase 5: Decision Registry
 * Decisions with voting and approval tracking.
 *
 * SOLID: Single Responsibility — owns decision lifecycle only.
 */

import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import type {
  IProjectDecisionRepository,
  ListDecisionsOptions,
  ProjectDecision,
} from './interfaces/project-decision.interface';
import type { CreateDecisionDto, UpdateDecisionDto } from './dto/project-decision.dto';

export const PROJECT_DECISION_REPOSITORY = 'PROJECT_DECISION_REPOSITORY';
export const PROJECT_DECISION_SERVICE = 'PROJECT_DECISION_SERVICE';

@Injectable()
export class ProjectDecisionService {
  private readonly logger = new Logger(ProjectDecisionService.name);

  constructor(
    @Inject(PROJECT_DECISION_REPOSITORY)
    private readonly repo: IProjectDecisionRepository,
  ) {}

  async create(tenantId: string, dto: CreateDecisionDto): Promise<ProjectDecision> {
    return this.repo.create({
      projectId: dto.projectId,
      title: dto.title,
      description: dto.description,
      status: dto.status,
      rationale: dto.rationale,
      meetingNotes: dto.meetingNotes,
      effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      linkedEntityType: dto.linkedEntityType,
      linkedEntityId: dto.linkedEntityId,
    });
  }

  async findById(id: string, tenantId: string): Promise<ProjectDecision> {
    const entry = await this.repo.findById(id, tenantId);
    if (!entry) throw new NotFoundException(`ProjectDecision ${id} not found`);
    return entry;
  }

  async findAll(
    tenantId: string,
    options?: ListDecisionsOptions,
  ): Promise<{ data: ProjectDecision[]; total: number }> {
    return this.repo.findAll(options ?? {}, tenantId);
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateDecisionDto,
  ): Promise<ProjectDecision> {
    return this.repo.update(id, tenantId, {
      title: dto.title,
      description: dto.description,
      status: dto.status,
      rationale: dto.rationale,
      meetingNotes: dto.meetingNotes,
      effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      supersededBy: dto.supersededBy,
    });
  }

  async castVote(
    id: string,
    tenantId: string,
    vote: 'FOR' | 'AGAINST' | 'ABSTAIN',
  ): Promise<ProjectDecision> {
    await this.repo.findById(id, tenantId);
    return this.repo.castVote(id, vote);
  }

  async approve(id: string, tenantId: string, approvedById: string, approvedByType = 'HUMAN'): Promise<ProjectDecision> {
    await this.repo.findById(id, tenantId);
    return this.repo.approve(id, approvedById, approvedByType);
  }

  async supersede(id: string, supersededById: string): Promise<void> {
    await this.repo.supersede(id, supersededById);
  }

  async getForProject(projectId: string, tenantId: string): Promise<ProjectDecision[]> {
    const result = await this.repo.findAll({ projectId }, tenantId);
    return result.data;
  }
}
