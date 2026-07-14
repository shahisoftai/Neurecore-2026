/**
 * WorkRunRepository — durable persistence for runs + steps (ADR-003).
 * Tenant-scoped, optimistic concurrency on run.version. This is the ONLY place
 * in the runtime that touches Prisma (for its OWN tables) — the runtime
 * orchestration/planner layers never import Prisma (architecture test).
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  ActorType,
  CreateRunInput,
  ToolEffect,
  WorkPlan,
  WorkRunStatus,
  WorkRunStepStatus,
} from '../contracts/work-runtime.interface';

@Injectable()
export class WorkRunRepository {
  private readonly logger = new Logger(WorkRunRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  async createRun(input: CreateRunInput) {
    return this.prisma.workRun.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        actorType: input.actorType,
        hermesAgentId: input.hermesAgentId ?? null,
        workspaceId: input.workspaceId ?? null,
        threadId: input.threadId ?? null,
        request: input.request,
        contextProvenance: input.contextProvenance as Prisma.InputJsonValue,
        status: 'CREATED',
      },
    });
  }

  async findRun(runId: string, tenantId: string) {
    // Tenant-scoped: never returns another tenant's run.
    return this.prisma.workRun.findFirst({ where: { id: runId, tenantId } });
  }

  async listSteps(runId: string, tenantId: string) {
    return this.prisma.workRunStep.findMany({
      where: { runId, tenantId },
      orderBy: { sequence: 'asc' },
    });
  }

  /** Optimistic-concurrency run update: only succeeds if version matches. */
  async updateRun(
    runId: string,
    tenantId: string,
    expectedVersion: number,
    data: Partial<{
      status: WorkRunStatus;
      currentStepIndex: number;
      planVersion: number;
      plan: WorkPlan;
      summary: string;
      failureCode: string;
      failureReason: string;
      startedAt: Date;
      pausedAt: Date;
      completedAt: Date;
      cancelledAt: Date;
      failedAt: Date;
    }>,
  ): Promise<boolean> {
    const res = await this.prisma.workRun.updateMany({
      where: { id: runId, tenantId, version: expectedVersion },
      data: {
        ...data,
        plan: data.plan ? (data.plan as unknown as Prisma.InputJsonValue) : undefined,
        version: { increment: 1 },
      } as Prisma.WorkRunUpdateManyMutationInput,
    });
    return res.count === 1;
  }

  async createStep(input: {
    runId: string;
    tenantId: string;
    sequence: number;
    toolName: string;
    capability: string;
    operationType: ToolEffect;
    input: Record<string, unknown>;
    idempotencyKey: string;
  }) {
    return this.prisma.workRunStep.create({
      data: {
        runId: input.runId,
        tenantId: input.tenantId,
        sequence: input.sequence,
        toolName: input.toolName,
        capability: input.capability,
        operationType: input.operationType,
        input: input.input as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey,
        status: 'PENDING',
      },
    });
  }

  async updateStep(
    stepId: string,
    tenantId: string,
    data: Partial<{
      status: WorkRunStepStatus;
      governanceDecision: string;
      governanceReason: string;
      policySource: string;
      approvalId: string;
      attemptCount: number;
      result: Record<string, unknown>;
      errorCode: string;
      errorMessage: string;
      startedAt: Date;
      completedAt: Date;
    }>,
  ): Promise<void> {
    await this.prisma.workRunStep.updateMany({
      where: { id: stepId, tenantId },
      data: {
        ...data,
        result: data.result ? (data.result as Prisma.InputJsonValue) : undefined,
      } as Prisma.WorkRunStepUpdateManyMutationInput,
    });
  }

  /** Atomic step claim: PENDING/APPROVED → RUNNING only once (two-worker safe). */
  async claimStep(
    stepId: string,
    tenantId: string,
    from: WorkRunStepStatus[],
  ): Promise<boolean> {
    const res = await this.prisma.workRunStep.updateMany({
      where: { id: stepId, tenantId, status: { in: from } },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    return res.count === 1;
  }

  async findStepByApproval(approvalId: string, tenantId: string) {
    return this.prisma.workRunStep.findFirst({
      where: { approvalId, tenantId },
    });
  }

  /** Business-effect idempotency: has this key already produced a step effect? */
  async findSucceededByIdempotencyKey(idempotencyKey: string, tenantId: string) {
    return this.prisma.workRunStep.findFirst({
      where: { tenantId, idempotencyKey, status: 'SUCCEEDED' },
    });
  }
}
