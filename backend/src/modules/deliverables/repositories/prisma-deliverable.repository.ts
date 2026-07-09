/**
 * Deliverables Module — Prisma Repository Implementation
 *
 * Following SOLID:
 * - Single Responsibility: only Deliverable + DeliverableVersion data access
 * - Dependency Inversion: implements IDeliverableRepository
 * - Tenant Isolation: all queries scoped to tenantId via Project membership
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import type {
  IDeliverableRepository,
  Deliverable,
  DeliverableVersion,
  CreateDeliverableInput,
  UpdateDeliverableInput,
  CreateDeliverableVersionInput,
  ListDeliverablesOptions,
} from '../interfaces/deliverable.interface';

@Injectable()
export class PrismaDeliverableRepository implements IDeliverableRepository {
  private readonly logger = new Logger(PrismaDeliverableRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateDeliverableInput): Promise<Deliverable> {
    this.logger.debug(`Creating deliverable: ${data.name}`);
    const created = await this.prisma.deliverable.create({
      data: {
        projectId: data.projectId,
        taskId: data.taskId ?? null,
        goalId: data.goalId ?? null,
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? 'DRAFT',
        riskTier: data.riskTier ?? null,
      },
    });
    return this.mapToDeliverable(created);
  }

  async findById(id: string, tenantId: string): Promise<Deliverable | null> {
    const found = await this.prisma.deliverable.findFirst({
      where: { id, project: { tenantId } },
    });
    return found ? this.mapToDeliverable(found) : null;
  }

  async findAll(
    options: ListDeliverablesOptions,
    tenantId: string,
  ): Promise<{ data: Deliverable[]; total: number }> {
    const where: Record<string, unknown> = { project: { tenantId } };

    if (options.projectId) where.projectId = options.projectId;
    if (options.goalId) where.goalId = options.goalId;
    if (options.status) where.status = options.status;

    const page = options.page || 1;
    const limit = options.limit || 20;

    const [items, total] = await Promise.all([
      this.prisma.deliverable.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.deliverable.count({ where }),
    ]);

    return {
      data: items.map((d) => this.mapToDeliverable(d)),
      total,
    };
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateDeliverableInput,
  ): Promise<Deliverable> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Deliverable ${id} not found`);
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.riskTier !== undefined) updateData.riskTier = data.riskTier;

    const updated = await this.prisma.deliverable.update({
      where: { id },
      data: updateData as Prisma.DeliverableUpdateInput,
    });
    return this.mapToDeliverable(updated);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Deliverable ${id} not found`);
    }
    await this.prisma.deliverable.delete({ where: { id } });
    this.logger.log(`Deleted deliverable: ${id}`);
  }

  // ─── Version operations ─────────────────────────────────────────────────────

  async createVersion(
    deliverableId: string,
    data: CreateDeliverableVersionInput,
  ): Promise<DeliverableVersion> {
    const latest = await this.prisma.deliverableVersion.findFirst({
      where: { deliverableId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const created = await this.prisma.deliverableVersion.create({
      data: {
        deliverableId,
        version: nextVersion,
        content: data.content as Prisma.InputJsonValue,
        summary: data.summary ?? null,
        producedBy: data.producedBy ?? null,
        producedByTaskId: data.producedByTaskId ?? null,
      },
    });
    return this.mapToVersion(created);
  }

  async findVersionsByDeliverableId(
    deliverableId: string,
  ): Promise<DeliverableVersion[]> {
    const items = await this.prisma.deliverableVersion.findMany({
      where: { deliverableId },
      orderBy: { version: 'desc' },
    });
    return items.map((v) => this.mapToVersion(v));
  }

  async getLatestVersion(
    deliverableId: string,
  ): Promise<DeliverableVersion | null> {
    const found = await this.prisma.deliverableVersion.findFirst({
      where: { deliverableId },
      orderBy: { version: 'desc' },
    });
    return found ? this.mapToVersion(found) : null;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private mapToDeliverable(raw: {
    id: string;
    projectId: string;
    taskId: string | null;
    goalId: string | null;
    name: string;
    description: string | null;
    status: string;
    riskTier: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Deliverable {
    return {
      id: raw.id,
      projectId: raw.projectId,
      taskId: raw.taskId,
      goalId: raw.goalId,
      name: raw.name,
      description: raw.description,
      status: raw.status as Deliverable['status'],
      riskTier: raw.riskTier as Deliverable['riskTier'],
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  private mapToVersion(raw: {
    id: string;
    deliverableId: string;
    version: number;
    content: unknown;
    summary: string | null;
    producedBy: string | null;
    producedByTaskId: string | null;
    createdAt: Date;
  }): DeliverableVersion {
    return {
      id: raw.id,
      deliverableId: raw.deliverableId,
      version: raw.version,
      content: raw.content as Record<string, unknown>,
      summary: raw.summary,
      producedBy: raw.producedBy,
      producedByTaskId: raw.producedByTaskId,
      createdAt: raw.createdAt,
    };
  }
}
