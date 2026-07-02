import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import type {
  IApprovalWorkflow,
  CreateWorkflowInput,
  ApprovalWorkflowDescriptor,
  WorkflowStepDescriptor,
  ApprovalDecision,
} from '../interfaces/approval-workflow.interface';
import type {
  ApprovalStatus,
  UserRole,
  ApprovalWorkflowType,
} from '@prisma/client';

@Injectable()
export class ApprovalWorkflowEngine implements IApprovalWorkflow {
  private readonly logger = new Logger(ApprovalWorkflowEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    input: CreateWorkflowInput,
  ): Promise<ApprovalWorkflowDescriptor> {
    if (!input.steps || input.steps.length === 0) {
      throw new BadRequestException('At least one approval step is required');
    }

    const sortedSteps = [...input.steps].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );

    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        name: input.name,
        workflowType: input.workflowType as ApprovalWorkflowType,
        status: 'PENDING' as ApprovalStatus,
        context: input.context as never,
        requesterId: input.requesterId,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        routineRunId: input.routineRunId,
        currentStep: 0,
        steps: {
          create: sortedSteps.map((step) => ({
            stepOrder: step.stepOrder,
            approverRole: step.approverRole,
            approverId: step.approverId,
            status: 'PENDING' as ApprovalStatus,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    this.logger.log(
      `[ApprovalWorkflow] Created workflow ${workflow.id} (${input.workflowType}) for requester ${input.requesterId}`,
    );

    await this.notifyApprovers(workflow, workflow.steps[0]);

    return this.toDescriptor(workflow);
  }

  async advance(
    workflowId: string,
    approverId: string,
    decision: ApprovalDecision,
    comment?: string,
  ): Promise<ApprovalWorkflowDescriptor> {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== 'PENDING') {
      throw new BadRequestException(`Workflow ${workflowId} is not pending`);
    }

    const currentStep = workflow.steps[workflow.currentStep];
    if (!currentStep) {
      throw new BadRequestException(
        `No current step found for workflow ${workflowId}`,
      );
    }

    const canApprove = await this.canApprove(
      workflowId,
      approverId,
      workflow.tenantId,
    );
    if (!canApprove) {
      throw new BadRequestException(
        `User ${approverId} cannot approve this workflow`,
      );
    }

    const now = new Date();
    let nextStatus: ApprovalStatus;

    if (decision === 'APPROVED') {
      nextStatus = 'APPROVED';

      const isLastStep = workflow.currentStep >= workflow.steps.length - 1;

      if (isLastStep) {
        const updated = await this.prisma.approvalWorkflow.update({
          where: { id: workflowId },
          data: {
            status: 'APPROVED' as ApprovalStatus,
            completedAt: now,
            result: {
              finalDecision: 'APPROVED',
              approvedBy: approverId,
              approvedAt: now.toISOString(),
            } as never,
            steps: {
              update: {
                where: { id: currentStep.id },
                data: {
                  status: 'APPROVED' as ApprovalStatus,
                  decision: 'APPROVED',
                  comment,
                  decidedAt: now,
                  approverId,
                },
              },
            },
          },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });

        await this.notifyRequester(workflow, 'APPROVED', approverId);
        this.logger.log(
          `[ApprovalWorkflow] Workflow ${workflowId} fully approved`,
        );
        return this.toDescriptor(updated);
      } else {
        await this.prisma.approvalWorkflowStep.update({
          where: { id: currentStep.id },
          data: {
            status: 'APPROVED' as ApprovalStatus,
            decision: 'APPROVED',
            comment,
            decidedAt: now,
            approverId,
          },
        });

        const nextStepIndex = workflow.currentStep + 1;
        const updated = await this.prisma.approvalWorkflow.update({
          where: { id: workflowId },
          data: {
            currentStep: nextStepIndex,
            steps: {
              update: {
                where: { id: workflow.steps[nextStepIndex].id },
                data: { status: 'PENDING' as ApprovalStatus },
              },
            },
          },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });

        await this.notifyApprovers(updated, updated.steps[nextStepIndex]);
        this.logger.log(
          `[ApprovalWorkflow] Workflow ${workflowId} advanced to step ${nextStepIndex}`,
        );
        return this.toDescriptor(updated);
      }
    } else if (decision === 'REJECTED') {
      const updated = await this.prisma.approvalWorkflow.update({
        where: { id: workflowId },
        data: {
          status: 'REJECTED' as ApprovalStatus,
          completedAt: now,
          result: {
            finalDecision: 'REJECTED',
            rejectedBy: approverId,
            rejectedAt: now.toISOString(),
          } as never,
          steps: {
            update: {
              where: { id: currentStep.id },
              data: {
                status: 'REJECTED' as ApprovalStatus,
                decision: 'REJECTED',
                comment,
                decidedAt: now,
                approverId,
              },
            },
          },
        },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      await this.notifyRequester(workflow, 'REJECTED', approverId);
      this.logger.log(`[ApprovalWorkflow] Workflow ${workflowId} rejected`);
      return this.toDescriptor(updated);
    } else {
      const isLastStep = workflow.currentStep >= workflow.steps.length - 1;

      await this.prisma.approvalWorkflowStep.update({
        where: { id: currentStep.id },
        data: {
          status: 'CANCELLED' as ApprovalStatus,
          decision: 'SKIPPED',
          comment,
          decidedAt: now,
          approverId,
        },
      });

      if (isLastStep) {
        const updated = await this.prisma.approvalWorkflow.update({
          where: { id: workflowId },
          data: {
            status: 'CANCELLED' as ApprovalStatus,
            completedAt: now,
          },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
        return this.toDescriptor(updated);
      }

      const nextStepIndex = workflow.currentStep + 1;
      const updated = await this.prisma.approvalWorkflow.update({
        where: { id: workflowId },
        data: { currentStep: nextStepIndex },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      await this.notifyApprovers(updated, updated.steps[nextStepIndex]);
      return this.toDescriptor(updated);
    }
  }

  async cancel(
    workflowId: string,
    actorId: string,
    reason?: string,
  ): Promise<void> {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: { steps: true },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== 'PENDING') {
      throw new BadRequestException('Only pending workflows can be cancelled');
    }

    await this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: 'CANCELLED' as ApprovalStatus,
        completedAt: new Date(),
        result: { cancelledBy: actorId, reason } as never,
      },
    });

    this.logger.log(
      `[ApprovalWorkflow] Workflow ${workflowId} cancelled by ${actorId}`,
    );
  }

  async getStatus(
    workflowId: string,
    tenantId: string,
  ): Promise<ApprovalWorkflowDescriptor | null> {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { id: workflowId, tenantId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    return workflow ? this.toDescriptor(workflow) : null;
  }

  async canApprove(
    workflowId: string,
    approverId: string,
    tenantId: string,
  ): Promise<boolean> {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { id: workflowId, tenantId },
      include: { steps: true },
    });

    if (!workflow || workflow.status !== 'PENDING') return false;

    const currentStep = workflow.steps[workflow.currentStep];
    if (!currentStep) return false;

    if (currentStep.approverId && currentStep.approverId !== approverId) {
      return false;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: approverId, tenantId },
    });

    if (!user) return false;

    return currentStep.approverRole.some((role) => user.role === role);
  }

  async getPendingForApprover(
    approverId: string,
    tenantId: string,
  ): Promise<ApprovalWorkflowDescriptor[]> {
    const user = await this.prisma.user.findFirst({
      where: { id: approverId, tenantId },
    });

    if (!user) return [];

    const pendingWorkflows = await this.prisma.approvalWorkflow.findMany({
      where: { tenantId, status: 'PENDING' as ApprovalStatus },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    const eligible: typeof pendingWorkflows = [];

    for (const wf of pendingWorkflows) {
      const currentStep = wf.steps[wf.currentStep];
      if (!currentStep || currentStep.status !== 'PENDING') continue;

      const canApprove =
        currentStep.approverId === approverId ||
        currentStep.approverRole.some((role) => user.role === role);

      if (canApprove) {
        eligible.push(wf);
      }
    }

    return eligible.map((w) => this.toDescriptor(w));
  }

  async expire(workflowId: string): Promise<void> {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow || workflow.status !== 'PENDING') return;

    await this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: 'EXPIRED' as ApprovalStatus,
        completedAt: new Date(),
        result: {
          reason: 'expired',
          expiredAt: new Date().toISOString(),
        } as never,
      },
    });

    this.logger.log(`[ApprovalWorkflow] Workflow ${workflowId} expired`);
  }

  async expireOldWorkflows(
    olderThanHours: number,
    tenantId?: string,
  ): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const result = await this.prisma.approvalWorkflow.updateMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: 'PENDING' as ApprovalStatus,
        createdAt: { lt: cutoff },
      },
      data: {
        status: 'EXPIRED' as ApprovalStatus,
        completedAt: new Date(),
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `[ApprovalWorkflow] Expired ${result.count} old workflows`,
      );
    }

    return result.count;
  }

  private async notifyApprovers(
    workflow: {
      id: string;
      name: string;
      workflowType: string;
      tenantId: string;
      steps: {
        stepOrder: number;
        approverRole: UserRole[];
        approverId?: string | null;
      }[];
    },
    step: {
      stepOrder: number;
      approverRole: UserRole[];
      approverId?: string | null;
    },
  ): Promise<void> {
    const title = `Approval Required: ${workflow.name}`;
    const currentStepIdx = workflow.steps.findIndex(
      (s) => s.stepOrder === step.stepOrder,
    );
    const message = `A ${workflow.workflowType} workflow requires your approval. Step ${currentStepIdx + 1} of ${workflow.steps.length}.`;

    if (step.approverId) {
      await this.notifications.create({
        type: 'WORKFLOW' as any,
        title,
        message,
        tenantId: workflow.tenantId,
        userId: step.approverId,
        payload: {
          workflowId: workflow.id,
          workflowType: workflow.workflowType,
        },
      });
    } else {
      this.logger.debug(
        `[ApprovalWorkflow] Would notify role-holders: ${step.approverRole.join(', ')}`,
      );
    }
  }

  private async notifyRequester(
    workflow: {
      id: string;
      name: string;
      workflowType: string;
      requesterId: string;
      tenantId: string;
    },
    decision: string,
    decidedBy: string,
  ): Promise<void> {
    await this.notifications.create({
      type: 'WORKFLOW' as any,
      title: `Workflow ${decision.toLowerCase()}: ${workflow.name}`,
      message: `Your ${workflow.workflowType} workflow has been ${decision.toLowerCase()} by ${decidedBy}.`,
      tenantId: workflow.tenantId,
      userId: workflow.requesterId,
      payload: {
        workflowId: workflow.id,
        workflowType: workflow.workflowType,
        decision,
      },
    });
  }

  private toDescriptor(workflow: {
    id: string;
    name: string;
    workflowType: ApprovalWorkflowType;
    status: ApprovalStatus;
    currentStep: number;
    context: unknown;
    result?: unknown;
    requesterId: string;
    tenantId: string;
    workspaceId?: string | null;
    routineRunId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date | null;
    steps: Array<{
      id: string;
      stepOrder: number;
      approverRole: UserRole[];
      approverId?: string | null;
      status: ApprovalStatus;
      decision?: string | null;
      comment?: string | null;
      decidedAt?: Date | null;
    }>;
  }): ApprovalWorkflowDescriptor {
    return {
      id: workflow.id,
      name: workflow.name,
      workflowType: workflow.workflowType,
      status: workflow.status,
      currentStep: workflow.currentStep,
      context: workflow.context as Record<string, unknown>,
      result: workflow.result as Record<string, unknown> | undefined,
      steps: workflow.steps.map(
        (s): WorkflowStepDescriptor => ({
          id: s.id,
          stepOrder: s.stepOrder,
          approverRole: s.approverRole,
          approverId: s.approverId ?? undefined,
          status: s.status,
          decision: s.decision ?? undefined,
          comment: s.comment ?? undefined,
          decidedAt: s.decidedAt ?? undefined,
        }),
      ),
      requesterId: workflow.requesterId,
      tenantId: workflow.tenantId,
      workspaceId: workflow.workspaceId ?? undefined,
      routineRunId: workflow.routineRunId ?? undefined,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      completedAt: workflow.completedAt ?? undefined,
    };
  }
}
