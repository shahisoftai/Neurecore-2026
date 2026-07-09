/**
 * execution-log module — Prisma Repository
 *
 * Phase 4: Append-only log. No update/delete — ever.
 * SOLID: Single Responsibility, Dependency Inversion
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import type {
  IExecutionLogRepository,
  CreateLogEntryInput,
  ListLogEntriesOptions,
  TaskExecutionLogEntry,
} from '../interfaces/execution-log.interface';

@Injectable()
export class PrismaExecutionLogRepository implements IExecutionLogRepository {
  private readonly logger = new Logger(PrismaExecutionLogRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateLogEntryInput): Promise<TaskExecutionLogEntry> {
    const entry = await this.prisma.taskExecutionLogEntry.create({
      data: {
        taskId: data.taskId,
        agentId: data.agentId ?? null,
        action: data.action,
        actorType: data.actorType ?? 'HUMAN',
        actorId: data.actorId ?? null,
        previousStepId: data.previousStepId ?? null,
        nextStepId: data.nextStepId ?? null,
        notes: data.notes ?? null,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.map(entry);
  }

  async findByTaskId(taskId: string, limit = 50): Promise<TaskExecutionLogEntry[]> {
    const entries = await this.prisma.taskExecutionLogEntry.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return entries.map((e) => this.map(e));
  }

  async findByAgentId(agentId: string, limit = 50): Promise<TaskExecutionLogEntry[]> {
    const entries = await this.prisma.taskExecutionLogEntry.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return entries.map((e) => this.map(e));
  }

  async findAll(
    options: ListLogEntriesOptions,
    tenantId: string,
  ): Promise<{ data: TaskExecutionLogEntry[]; total: number }> {
    const where: Record<string, unknown> = { task: { tenantId } };
    if (options.taskId) where.taskId = options.taskId;
    if (options.agentId) where.agentId = options.agentId;
    if (options.action) where.action = options.action;

    const page = options.page ?? 1;
    const limit = options.limit ?? 50;

    const [items, total] = await Promise.all([
      this.prisma.taskExecutionLogEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.taskExecutionLogEntry.count({ where }),
    ]);

    return { data: items.map((e) => this.map(e)), total };
  }

  private map(raw: {
    id: string;
    taskId: string;
    agentId: string | null;
    action: string;
    actorType: string;
    actorId: string | null;
    previousStepId: string | null;
    nextStepId: string | null;
    notes: string | null;
    metadata: unknown;
    createdAt: Date;
  }): TaskExecutionLogEntry {
    return {
      id: raw.id,
      taskId: raw.taskId,
      agentId: raw.agentId,
      action: raw.action,
      actorType: raw.actorType,
      actorId: raw.actorId,
      previousStepId: raw.previousStepId,
      nextStepId: raw.nextStepId,
      notes: raw.notes,
      metadata: raw.metadata as Record<string, unknown>,
      createdAt: raw.createdAt,
    };
  }
}
