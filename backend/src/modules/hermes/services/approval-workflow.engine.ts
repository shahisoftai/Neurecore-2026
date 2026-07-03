import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import type { ApprovalWorkflow } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { IApprovalWorkflowEngine } from '../interfaces/approval-workflow.interface';
import type {
  CreateWorkflowInput,
  ApprovalWorkflowWithSteps,
  ApprovalDecision,
} from '../interfaces/approval-workflow.interface';
import {
  APPROVAL_TIMEOUT_HOURS,
  APPROVAL_WORKFLOW_STEPS,
} from '../common/hermes.constants';

@Injectable()
export class ApprovalWorkflowEngine implements IApprovalWorkflowEngine {
  private readonly logger = new Logger(
    ApprovalWorkflowEngine.name,
  );

  constructor(private readonly prisma: PrismaService) {}

  async createWorkflow(
    params: CreateWorkflowInput,
  ): Promise<ApprovalWorkflow> {
    const { steps, ...workflowData } = params;

    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        name: workflowData.name,
        description: workflowData.description,
        workflowType: workflowData.workflowType,
        context: workflowData.context as any,
        requesterId: workflowData.requesterId,
        tenantId: workflowData.tenantId,
        workspaceId: workflowData.workspaceId,
        routineRunId: workflowData.routineRunId,
      },
    });

    for (const step of steps) {
      await this.prisma.approvalWorkflowStep.create({
        data: {
          approvalWorkflowId: workflow.id,
          stepOrder: step.stepOrder,
          approverRole: step.approverRole,
          approverId: step.approverId,
        },
      });
    }

    this.logger.log(
      `Created approval workflow "${workflow.name}" (${workflow.id}) with ${steps.length} steps`,
    );

    return workflow;
  }

  async advanceStep(
    workflowId: string,
    approverId: string,
    decision: ApprovalDecision,
    comment?: string,
  ): Promise<ApprovalWorkflow> {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!workflow) {
      throw new NotFoundException(
        `Approval workflow ${workflowId} not found`,
      );
    }

    if (
      workflow.status !== ApprovalStatus.PENDING
    ) {
      throw new ConflictException(
        `Workflow ${workflowId} is already ${workflow.status}`,
      );
    }

    const currentStep = workflow.steps.find(
      (s) => s.stepOrder === workflow.currentStep,
    );

    if (!currentStep) {
      throw new NotFoundException(
        `No step at order ${workflow.currentStep} in workflow ${workflowId}`,
      );
    }

    await this.prisma.approvalWorkflowStep.update({
      where: { id: currentStep.id },
      data: {
        approverId,
        status: decision as any,
        decision,
        comment,
        decidedAt: new Date(),
      },
    });

    if (decision === 'REJECTED') {
      await this.prisma.approvalWorkflow.update({
        where: { id: workflowId },
        data: {
          status: 'REJECTED' as any,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Workflow ${workflowId} REJECTED at step ${currentStep.stepOrder}`,
      );

      return this.prisma.approvalWorkflow.findUniqueOrThrow({
        where: { id: workflowId },
      });
    }

    const nextStepOrder = workflow.currentStep + 1;
    const hasNextStep = workflow.steps.some(
      (s) => s.stepOrder === nextStepOrder,
    );

    if (hasNextStep) {
      await this.prisma.approvalWorkflow.update({
        where: { id: workflowId },
        data: {
          status: ApprovalStatus.PENDING,
          currentStep: nextStepOrder,
        },
      });

      this.logger.log(
        `Workflow ${workflowId} advanced to step ${nextStepOrder}`,
      );
    } else {
      await this.prisma.approvalWorkflow.update({
        where: { id: workflowId },
      data: {
        status: 'APPROVED' as any,
        completedAt: new Date(),
      },
      });

      this.logger.log(
        `Workflow ${workflowId} fully APPROVED`,
      );
    }

    return this.prisma.approvalWorkflow.findUniqueOrThrow({
      where: { id: workflowId },
    });
  }

  async cancelWorkflow(
    workflowId: string,
    actorId: string,
  ): Promise<void> {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundException(
        `Approval workflow ${workflowId} not found`,
      );
    }

    await this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: 'CANCELLED' as any,
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `Workflow ${workflowId} cancelled by ${actorId}`,
    );
  }

  async getWorkflowStatus(
    workflowId: string,
    tenantId: string,
  ): Promise<ApprovalWorkflowWithSteps> {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { id: workflowId, tenantId },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    if (!workflow) {
      throw new NotFoundException(
        `Approval workflow ${workflowId} not found`,
      );
    }

    const timeInState =
      Date.now() - (workflow.completedAt ?? workflow.updatedAt).getTime();

    return {
      ...workflow,
      steps: workflow.steps.map((s) => ({
        stepOrder: s.stepOrder,
        approverRole: s.approverRole,
        approverId: s.approverId ?? undefined,
        status: s.status,
        decision: s.decision ?? undefined,
        comment: s.comment ?? undefined,
        decidedAt: s.decidedAt ?? undefined,
      })),
      timeInState,
    };
  }

  async canApprove(
    workflowId: string,
    approverId: string,
  ): Promise<boolean> {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!workflow) return false;

    const currentStep = workflow.steps.find(
      (s) =>
        s.stepOrder === workflow.currentStep &&
        s.status === ApprovalStatus.PENDING,
    );

    if (!currentStep) return false;

    return currentStep.approverId === approverId;
  }

  async expiresAt(workflowId: string): Promise<Date> {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      select: { createdAt: true },
    });

    if (!workflow) {
      throw new NotFoundException(
        `Approval workflow ${workflowId} not found`,
      );
    }

    const expiry = new Date(workflow.createdAt);
    expiry.setHours(expiry.getHours() + APPROVAL_TIMEOUT_HOURS);
    return expiry;
  }

  async handleExpiredWorkflows(
    tenantId: string,
  ): Promise<number> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - APPROVAL_TIMEOUT_HOURS);

    const result = await this.prisma.approvalWorkflow.updateMany({
      where: {
        tenantId,
        createdAt: { lt: cutoff },
        status: ApprovalStatus.PENDING,
      },
      data: {
        status: 'EXPIRED' as any,
        completedAt: new Date(),
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Expired ${result.count} approval workflows in tenant ${tenantId}`,
      );
    }

    return result.count;
  }
}
