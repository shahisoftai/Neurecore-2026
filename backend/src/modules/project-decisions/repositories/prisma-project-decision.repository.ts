/**
 * project-decisions module — Prisma Repository
 *
 * Phase 5: Decision Registry
 * Decisions with voting and approval tracking.
 *
 * SOLID: Single Responsibility, Dependency Inversion.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import type {
  IProjectDecisionRepository,
  CreateDecisionInput,
  UpdateDecisionInput,
  ListDecisionsOptions,
  ProjectDecision,
} from '../interfaces/project-decision.interface';

@Injectable()
export class PrismaProjectDecisionRepository implements IProjectDecisionRepository {
  private readonly logger = new Logger(PrismaProjectDecisionRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateDecisionInput): Promise<ProjectDecision> {
    const entry = await this.prisma.projectDecision.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? 'PROPOSED',
        rationale: data.rationale ?? null,
        meetingNotes: data.meetingNotes ?? null,
        effectiveDate: data.effectiveDate ?? null,
        expiryDate: data.expiryDate ?? null,
        linkedEntityType: data.linkedEntityType ?? null,
        linkedEntityId: data.linkedEntityId ?? null,
      },
    });
    return this.map(entry);
  }

  async findById(id: string, tenantId: string): Promise<ProjectDecision | null> {
    const entry = await this.prisma.projectDecision.findFirst({
      where: { id, project: { tenantId } },
    });
    return entry ? this.map(entry) : null;
  }

  async findAll(
    options: ListDecisionsOptions,
    tenantId: string,
  ): Promise<{ data: ProjectDecision[]; total: number }> {
    const where: Record<string, unknown> = { project: { tenantId } };

    if (options.projectId) where.projectId = options.projectId;
    if (options.status) where.status = options.status;
    if (options.linkedEntityId) where.linkedEntityId = options.linkedEntityId;

    const page = options.page ?? 1;
    const limit = options.limit ?? 50;

    const [items, total] = await Promise.all([
      this.prisma.projectDecision.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.projectDecision.count({ where }),
    ]);

    return { data: items.map((e) => this.map(e)), total };
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateDecisionInput,
  ): Promise<ProjectDecision> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`ProjectDecision ${id} not found`);
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'APPROVED' || data.status === 'REJECTED') {
        updateData.decidedAt = new Date();
      }
    }
    if (data.rationale !== undefined) updateData.rationale = data.rationale;
    if (data.meetingNotes !== undefined) updateData.meetingNotes = data.meetingNotes;
    if (data.effectiveDate !== undefined) updateData.effectiveDate = data.effectiveDate;
    if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate;
    if (data.supersededBy !== undefined) updateData.supersededBy = data.supersededBy;

    const updated = await this.prisma.projectDecision.update({
      where: { id },
      data: updateData as Prisma.ProjectDecisionUpdateInput,
    });
    return this.map(updated);
  }

  async castVote(
    id: string,
    vote: 'FOR' | 'AGAINST' | 'ABSTAIN',
  ): Promise<ProjectDecision> {
    const field = vote === 'FOR'
      ? 'votesFor'
      : vote === 'AGAINST'
        ? 'votesAgainst'
        : 'abstentions';

    const updated = await this.prisma.projectDecision.update({
      where: { id },
      data: { [field]: { increment: 1 } },
    });
    this.logger.debug(`Decision ${id}: vote ${vote} cast`);
    return this.map(updated);
  }

  async approve(
    id: string,
    approvedById: string,
    approvedByType: string,
  ): Promise<ProjectDecision> {
    const updated = await this.prisma.projectDecision.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById,
        approvedByType,
        decidedAt: new Date(),
      },
    });
    return this.map(updated);
  }

  async supersede(id: string, supersededById: string): Promise<void> {
    await this.prisma.projectDecision.update({
      where: { id },
      data: { supersededBy: supersededById, status: 'SUPERSEDED' },
    });
    this.logger.debug(`Decision ${id} superseded by ${supersededById}`);
  }

  private map(raw: {
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    status: string;
    decidedAt: Date | null;
    approvedById: string | null;
    approvedByType: string | null;
    votesFor: number;
    votesAgainst: number;
    abstentions: number;
    meetingNotes: string | null;
    rationale: string | null;
    effectiveDate: Date | null;
    expiryDate: Date | null;
    supersededBy: string | null;
    linkedEntityType: string | null;
    linkedEntityId: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectDecision {
    return {
      id: raw.id,
      projectId: raw.projectId,
      title: raw.title,
      description: raw.description,
      status: raw.status as ProjectDecision['status'],
      decidedAt: raw.decidedAt,
      approvedById: raw.approvedById,
      approvedByType: raw.approvedByType,
      votesFor: raw.votesFor,
      votesAgainst: raw.votesAgainst,
      abstentions: raw.abstentions,
      meetingNotes: raw.meetingNotes,
      rationale: raw.rationale,
      effectiveDate: raw.effectiveDate,
      expiryDate: raw.expiryDate,
      supersededBy: raw.supersededBy,
      linkedEntityType: raw.linkedEntityType,
      linkedEntityId: raw.linkedEntityId,
      metadata: raw.metadata as Record<string, unknown>,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
