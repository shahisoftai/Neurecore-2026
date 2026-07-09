/**
 * approval-chains module — Prisma Repository Implementation
 *
 * SOLID: SRP — data access only. DIP — implements IApprovalChainRepository.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { ApprovalWorkflow, ApprovalWorkflowStep } from '@prisma/client';
import type { IApprovalChainRepository } from '../interfaces/approval-chain.interface';

@Injectable()
export class PrismaApprovalChainRepository implements IApprovalChainRepository {
  private readonly logger = new Logger(PrismaApprovalChainRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findProjectTypeVersionById(
    projectTypeVersionId: string,
  ): Promise<{ approvalTemplate: unknown } | null> {
    return this.prisma.projectTypeVersion.findFirst({
      where: { id: projectTypeVersionId },
      select: { approvalTemplate: true },
    });
  }

  async findWorkflowById(
    workflowId: string,
  ): Promise<(ApprovalWorkflow & { steps: ApprovalWorkflowStep[] }) | null> {
    return this.prisma.approvalWorkflow.findFirst({
      where: { id: workflowId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async updateWorkflow(
    workflowId: string,
    data: { status?: 'APPROVED'; completedAt?: Date; currentStep?: number },
  ): Promise<void> {
    await this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: data as Record<string, unknown>,
    });
  }

  async findStepWithWorkflow(
    stepId: string,
  ): Promise<
    | (ApprovalWorkflowStep & {
        approvalWorkflow: ApprovalWorkflow & { steps: ApprovalWorkflowStep[] };
      })
    | null
  > {
    return this.prisma.approvalWorkflowStep.findFirst({
      where: { id: stepId },
      include: {
        approvalWorkflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
    });
  }

  async findWorkflows(
    tenantId: string,
    options: { status?: string[]; riskTier?: string },
  ): Promise<(ApprovalWorkflow & { steps: ApprovalWorkflowStep[] })[]> {
    const where: Record<string, unknown> = {
      tenantId,
      status: { in: options.status },
    };
    if (options.riskTier) where.riskTier = options.riskTier;

    return this.prisma.approvalWorkflow.findMany({
      where,
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
