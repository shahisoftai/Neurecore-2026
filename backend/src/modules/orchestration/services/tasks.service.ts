import { Injectable, Logger, NotFoundException, Inject, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import type { TaskPriority, TaskStatus } from '@prisma/client';
import { EVENT_TRANSPORT } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';

export const GOALS_SERVICE = 'GOALS_SERVICE';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    // DEPRECATED (Phase 2, ADR-001 §12): the in-memory ProjectEventBus. Retained
    // temporarily for the existing project-memory handlers; superseded by the
    // durable Enterprise Event Fabric below.
    @Optional() private readonly eventBus?: any,
    @Optional()
    @Inject(EVENT_TRANSPORT)
    private readonly transport?: IEnterpriseEventTransport,
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
    agentId?: string | null;
    workflowId?: string;
    scheduledAt?: string;
    createdById?: string | null;
    goalId?: string | null;
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
        createdById: input.createdById ?? null,
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
      title?: string;
      description?: string;
      priority?: TaskPriority;
      input?: Record<string, unknown>;
      agentId?: string | null;
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

    const existing = await this.prisma.task.findFirst({
      where: { id, tenantId },
      select: { startedAt: true },
    });

    const updateData: Record<string, unknown> = { status };
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }
    if (status === 'RUNNING' && existing && !existing.startedAt) {
      updateData.startedAt = new Date();
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

    // Phase 2: durable enterprise event (the migrated, cross-capability path).
    if (status === 'COMPLETED' && this.transport) {
      try {
        await this.transport.publish({
          eventType: 'enterprise.task.completed',
          tenantId,
          actorType: 'SYSTEM',
          idempotencyKey: `task.completed.${id}`,
          sourceModule: 'orchestration',
          payload: {
            taskId: id,
            projectId: updated.projectId,
            goalId: updated.goalId,
            status: 'COMPLETED',
            title: updated.title,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to publish enterprise.task.completed: ${err}`);
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

  /**
   * Reopen a previously completed/failed task back to PENDING.
   * Clears completion timestamp and any error message.
   */
  async reopen(id: string, tenantId: string) {
    await this.assertOwnership(id, tenantId);
    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'PENDING',
        completedAt: null,
        error: null,
      } as Prisma.TaskUpdateInput,
    });
  }

  /**
   * Find all subtasks of a given parent task. Uses the JSON `input.parentTaskId`
   * path until a proper parent-child relationship exists.
   */
  async findSubtasks(parentId: string, tenantId: string) {
    return this.prisma.task.findMany({
      where: {
        tenantId,
        input: { path: ['parentTaskId'], equals: parentId },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find tasks that are overdue — status not in COMPLETED/CANCELLED and
   * either has no completedAt timestamp, or was completed after the due date.
   * For now (no dueDate column), returns non-completed tasks as a proxy.
   */
  async findOverdue(tenantId: string, options?: { departmentId?: string; limit?: number }) {
    const { departmentId, limit = 50 } = options ?? {};
    return this.prisma.task.findMany({
      where: {
        tenantId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        ...(departmentId ? { departmentId } : {}),
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Bulk update status for multiple tasks. Each transition may emit events.
   */
  async bulkUpdateStatus(ids: string[], status: TaskStatus, tenantId: string) {
    const results: Array<{ id: string; status: 'updated' | 'failed'; error?: string }> = [];
    for (const id of ids) {
      try {
        await this.updateStatus(id, status, tenantId);
        results.push({ id, status: 'updated' });
      } catch (err) {
        results.push({
          id,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }

  /**
   * Clone a task to create a new task with the same properties (minus status,
   * timestamps, and IDs). Useful for templating.
   */
  async clone(sourceId: string, tenantId: string, overrides?: { assigneeId?: string; title?: string }) {
    const source = await this.findOne(sourceId, tenantId);
    return this.create(
      {
        title: overrides?.title ?? `${source.title} (Copy)`,
        description: source.description ?? undefined,
        priority: source.priority,
        agentId: overrides?.assigneeId !== undefined ? overrides.assigneeId : source.agentId,
        input: (source.input as Record<string, unknown> | null) ?? {},
        goalId: source.goalId ?? undefined,
      },
      tenantId,
    );
  }

  /**
   * Find tasks assigned to a specific agent (used by getMyTasks).
   */
  async findByAgent(agentId: string, tenantId: string, options?: { status?: TaskStatus; limit?: number }) {
    return this.prisma.task.findMany({
      where: {
        tenantId,
        agentId,
        ...(options?.status ? { status: options.status } : {}),
      },
      take: options?.limit ?? 50,
      orderBy: { createdAt: 'desc' },
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
