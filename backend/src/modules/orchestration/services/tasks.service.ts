import { Injectable, Logger, NotFoundException, Inject, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import type { TaskPriority, TaskStatus } from '@prisma/client';

export const GOALS_SERVICE = 'GOALS_SERVICE';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: any,
  ) {}

  async findAll(options?: {
    status?: TaskStatus;
    agentId?: string;
    goalId?: string;
    page?: number;
    limit?: number;
  }, tenantId?: string) {
    const { status, agentId, goalId, page = 1, limit = 20 } = options ?? {};
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(tenantId && tenantId !== '*' ? { tenantId } : {}),
      ...(status && { status }),
      ...(agentId && { agentId }),
      ...(goalId && { goalId }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, tenantId },
      include: {
        agent: { select: { id: true, name: true, status: true } },
        goal: { select: { id: true, title: true } },
        executionLogs: true,
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async create(input: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    input?: Record<string, unknown>;
    agentId?: string;
    workflowId?: string;
    scheduledAt?: string;
    createdById: string;
    goalId?: string;
    acceptanceCriteria?: string;
    expectedOutput?: Record<string, unknown>;
  }, tenantId: string) {
    return this.prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority ?? 'MEDIUM',
        input: (input.input ?? {}) as Prisma.InputJsonValue,
        agentId: input.agentId,
        workflowId: input.workflowId,
        scheduledAt: input.scheduledAt
          ? new Date(input.scheduledAt)
          : undefined,
        tenantId,
        createdById: input.createdById,
        goalId: input.goalId ?? null,
        acceptanceCriteria: input.acceptanceCriteria ?? null,
        expectedOutput: input.expectedOutput
          ? (input.expectedOutput as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  async update(
    id: string,
    data: {
      priority?: TaskPriority;
      input?: Record<string, unknown>;
      agentId?: string;
      goalId?: string | null;
      acceptanceCriteria?: string | null;
      expectedOutput?: Record<string, unknown> | null;
    },
    tenantId: string,
  ) {
    await this.assertOwnership(id, tenantId);
    const updateData: Record<string, unknown> = { ...data };
    if (data.input) {
      updateData.input = data.input as Prisma.InputJsonValue;
    }
    if (data.expectedOutput !== undefined) {
      updateData.expectedOutput = data.expectedOutput
        ? (data.expectedOutput as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    return this.prisma.task.update({
      where: { id },
      data: updateData as Prisma.TaskUpdateInput,
    });
  }

  /**
   * Update task status. When a task is completed, this triggers
   * goal progress recalculation if the task has a goalId.
   */
  async updateStatus(
    id: string,
    status: TaskStatus,
    tenantId: string,
  ) {
    await this.assertOwnership(id, tenantId);

    const updateData: Record<string, unknown> = { status };
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: updateData as Prisma.TaskUpdateInput,
    });

    if (status === 'COMPLETED' && updated.goalId) {
      this.logger.debug(`Task ${id} completed — goal ${updated.goalId} progress recalculation queued`);
    }

    if (status === 'COMPLETED' && this.eventBus) {
      try {
        this.eventBus.publish({
          type: 'TaskCompleted',
          projectId: updated.projectId,
          tenantId,
          timestamp: new Date(),
          payload: { taskId: id, goalId: updated.goalId, title: updated.title },
        });
      } catch (err) {
        this.logger.warn(`Failed to publish TaskCompleted event: ${err}`);
      }
    }

    return updated;
  }

  async remove(id: string, tenantId: string) {
    await this.assertOwnership(id, tenantId);
    await this.prisma.task.delete({ where: { id } });
  }

  async findByGoalId(goalId: string, tenantId: string) {
    return this.prisma.task.findMany({
      where: { goalId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async assertOwnership(id: string, tenantId: string) {
    const exists = await this.prisma.task.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Task ${id} not found`);
  }
}
