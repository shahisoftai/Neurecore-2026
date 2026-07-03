import type {
  ApprovalWorkflowType,
  ApprovalStatus,
  UserRole,
} from '@prisma/client';
import type { ApprovalWorkflow } from '@prisma/client';

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  workflowType: ApprovalWorkflowType;
  context: Record<string, unknown>;
  steps: {
    approverRole: UserRole[];
    approverId?: string;
    stepOrder: number;
  }[];
  requesterId: string;
  tenantId: string;
  workspaceId?: string;
  routineRunId?: string;
}

export interface WorkflowStepResult {
  stepOrder: number;
  approverRole: UserRole[];
  approverId?: string;
  status: ApprovalStatus;
  decision?: string;
  comment?: string;
  decidedAt?: Date;
}

export interface ApprovalWorkflowWithSteps extends ApprovalWorkflow {
  steps: WorkflowStepResult[];
  requesterName?: string;
  timeInState: number;
}

export type ApprovalDecision = 'APPROVED' | 'REJECTED';

export interface IApprovalWorkflowEngine {
  createWorkflow(
    params: CreateWorkflowInput,
  ): Promise<ApprovalWorkflow>;
  advanceStep(
    workflowId: string,
    approverId: string,
    decision: ApprovalDecision,
    comment?: string,
  ): Promise<ApprovalWorkflow>;
  cancelWorkflow(
    workflowId: string,
    actorId: string,
  ): Promise<void>;
  getWorkflowStatus(
    workflowId: string,
    tenantId: string,
  ): Promise<ApprovalWorkflowWithSteps>;
  canApprove(
    workflowId: string,
    approverId: string,
  ): Promise<boolean>;
  expiresAt(workflowId: string): Promise<Date>;
  handleExpiredWorkflows(tenantId: string): Promise<number>;
}
