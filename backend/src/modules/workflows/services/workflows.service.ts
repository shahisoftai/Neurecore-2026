/**
 * WorkflowsService — Business logic for workflow CRUD and execution.
 *
 * SOLID principles:
 *   - Single Responsibility: only workflow domain logic, no HTTP concerns
 *   - Dependency Inversion: depends on PrismaService (injected), not constructed
 *   - Interface Segregation: public API is a focused set of cohesive methods
 *
 * Status state machine:
 *   DRAFT  → ACTIVE   (activate)
 *   ACTIVE → PAUSED   (pause)
 *   PAUSED → ACTIVE  (activate)
 *   ACTIVE → ARCHIVED (archive)
 *   any    → DRAFT    (no — reset not allowed here)
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { WorkflowStatus } from '@prisma/client';
import type { CreateWorkflowDto } from '../dto/create-workflow.dto';
import type { UpdateWorkflowDto } from '../dto/update-workflow.dto';
import type {
  WorkflowResponseDto,
  WorkflowExecutionSummaryDto,
} from '../dto/workflow-response.dto';

interface ListWorkflowsOptions {
  page?: number;
  limit?: number;
  status?: WorkflowStatus;
  search?: string;
}

interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

type WorkflowWithMeta = WorkflowResponseDto & {
  _count?: { executions?: number };
};

const VALID_TRANSITIONS: Partial<Record<WorkflowStatus, WorkflowStatus[]>> = {
  [WorkflowStatus.ACTIVE]: [WorkflowStatus.PAUSED, WorkflowStatus.ARCHIVED],
  [WorkflowStatus.PAUSED]: [WorkflowStatus.ACTIVE],
  [WorkflowStatus.DRAFT]: [WorkflowStatus.ACTIVE],
};

function isValidTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  // ─── Read ────────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    options: ListWorkflowsOptions = {},
  ): Promise<ListResult<WorkflowWithMeta>> {
    const { page = 1, limit = 20, status, search } = options;

    const where = {
      tenantId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              {
                description: { contains: search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workflow.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { executions: true } } },
      }),
      this.prisma.workflow.count({ where }),
    ]);

    return {
      items: items.map((w) => this.mapWithMeta(w)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, tenantId: string): Promise<WorkflowWithMeta> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { executions: true } } },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }
    return this.mapWithMeta(workflow);
  }

  // ─── Create ──────────────────────────────────────────────────────────────

  async create(
    dto: CreateWorkflowDto,
    tenantId: string,
  ): Promise<WorkflowResponseDto> {
    const { nodes, edges, description, config, definition } = dto;

    const workflow = await this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: description ?? null,
        isTemplate: dto.isTemplate ?? false,
        config: (config ?? {}) as object,
        definition: (definition ?? {
          nodes: nodes ?? [],
          edges: edges ?? [],
        }) as object,
        status: WorkflowStatus.DRAFT,
        isActive: false,
        tenantId,
        executionCount: 0,
        successRate: 0,
      },
    });

    return this.mapWithMeta({ ...workflow, _count: { executions: 0 } });
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateWorkflowDto,
    tenantId: string,
  ): Promise<WorkflowResponseDto> {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { executions: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    if (existing.status === WorkflowStatus.ACTIVE) {
      // Only allow status transition to PAUSED while ACTIVE
      if (dto.status !== undefined && dto.status !== WorkflowStatus.PAUSED) {
        throw new BadRequestException(
          'Active workflows can only be paused. Use /workflows/:id/execute to run, or deactivate first.',
        );
      }
    }

    const { nodes, edges, definition, config, ...rest } = dto;

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...rest,
        ...(config !== undefined ? { config: config as object } : {}),
        ...(definition !== undefined ||
        nodes !== undefined ||
        edges !== undefined
          ? {
              definition: {
                ...((typeof existing.definition === 'object'
                  ? existing.definition
                  : {}) as Record<string, unknown>),
                ...(definition ?? {}),
                ...(nodes !== undefined ? { nodes } : {}),
                ...(edges !== undefined ? { edges } : {}),
              } as object,
            }
          : {}),
      },
    });

    return this.mapWithMeta({ ...updated, _count: existing._count });
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    if (
      existing.status !== WorkflowStatus.DRAFT &&
      existing.status !== WorkflowStatus.ARCHIVED
    ) {
      throw new ForbiddenException(
        'Only DRAFT or ARCHIVED workflows can be deleted.',
      );
    }

    await this.prisma.workflow.delete({ where: { id } });
  }

  // ─── Status transitions ─────────────────────────────────────────────────

  async activate(id: string, tenantId: string): Promise<WorkflowResponseDto> {
    return this.transitionStatus(id, tenantId, WorkflowStatus.ACTIVE);
  }

  async pause(id: string, tenantId: string): Promise<WorkflowResponseDto> {
    return this.transitionStatus(id, tenantId, WorkflowStatus.PAUSED);
  }

  private async transitionStatus(
    id: string,
    tenantId: string,
    targetStatus: WorkflowStatus,
  ): Promise<WorkflowResponseDto> {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { executions: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    if (!isValidTransition(existing.status, targetStatus)) {
      throw new BadRequestException(
        `Cannot transition workflow from ${existing.status} to ${targetStatus}.`,
      );
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        status: targetStatus,
        isActive: targetStatus === WorkflowStatus.ACTIVE,
      },
    });

    this.events.emitToTenant(tenantId, 'workflow:event', {
      workflowId: id,
      event:
        targetStatus === WorkflowStatus.ACTIVE
          ? 'workflow:activated'
          : 'workflow:paused',
      status: targetStatus,
      timestamp: Date.now(),
    });

    return this.mapWithMeta({ ...updated, _count: existing._count });
  }

  // ─── Execute ────────────────────────────────────────────────────────────

  async execute(
    id: string,
    tenantId: string,
    input?: Record<string, unknown>,
  ): Promise<{ executionId: string }> {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    if (existing.status !== WorkflowStatus.ACTIVE) {
      throw new BadRequestException(
        'Only ACTIVE workflows can be executed. Activate the workflow first.',
      );
    }

    // Create execution record
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId: id,
        tenantId,
        status: 'RUNNING',
      },
    });

    // Update workflow metadata
    await this.prisma.workflow.update({
      where: { id },
      data: {
        lastExecutedAt: new Date(),
        executionCount: { increment: 1 },
      },
    });

    this.events.emitToTenant(tenantId, 'workflow:event', {
      workflowId: id,
      event: 'workflow:started',
      executionId: execution.id,
      input,
      timestamp: Date.now(),
    });

    // TODO (Phase 2): Enqueue actual job via BullMQ here.
    // For now, we return the execution ID immediately.
    // The job worker would later call completeExecution / failExecution.

    return { executionId: execution.id };
  }

  // ─── Status summary ─────────────────────────────────────────────────────

  async getStatus(
    id: string,
    tenantId: string,
  ): Promise<WorkflowExecutionSummaryDto> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    // Compute average duration from recent executions
    const recentExecutions = await this.prisma.workflowExecution.findMany({
      where: { workflowId: id },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    const completedOnes = recentExecutions.filter(
      (e) => e.completedAt && e.durationMs,
    );
    const avgDurationMs =
      completedOnes.length > 0
        ? Math.round(
            completedOnes.reduce((sum, e) => sum + (e.durationMs ?? 0), 0) /
              completedOnes.length,
          )
        : null;

    const lastExecution = workflow.executions[0] ?? null;

    return {
      workflowId: id,
      totalRuns: workflow.executionCount,
      successRate: workflow.successRate,
      avgDurationMs,
      lastRunAt: workflow.lastExecutedAt ?? null,
      status: workflow.status,
    };
  }

  // ─── Map Prisma model → response DTO ───────────────────────────────────

  /**
   * mapWithMeta — extracts nodes/edges from `definition` JSON and attaches
   * the execution count so the frontend adapter receives the expected shape.
   */
  private mapWithMeta(
    workflow: {
      id: string;
      name: string;
      description: string | null;
      status: WorkflowStatus;
      isActive: boolean;
      isTemplate: boolean;
      tenantId: string;
      definition: unknown;
      lastExecutedAt: Date | null;
      executionCount: number;
      successRate: number;
      createdAt: Date;
      updatedAt: Date;
      _count?: { executions?: number } | null;
    } & {
      _count?: { executions?: number };
    },
  ): WorkflowWithMeta {
    const def =
      typeof workflow.definition === 'object' && workflow.definition !== null
        ? (workflow.definition as Record<string, unknown>)
        : {};

    const dto: WorkflowWithMeta = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      isActive: workflow.isActive,
      isTemplate: workflow.isTemplate,
      tenantId: workflow.tenantId,
      definition: def,
      nodes: Array.isArray(def.nodes) ? def.nodes : [],
      edges: Array.isArray(def.edges) ? def.edges : [],
      lastExecutedAt: workflow.lastExecutedAt,
      executionCount: workflow.executionCount,
      successRate: workflow.successRate,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      _count: workflow._count ?? { executions: 0 },
    };

    return dto;
  }
}
