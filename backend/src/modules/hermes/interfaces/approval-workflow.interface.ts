import type { HermesAgentType } from '@prisma/client';
import type { UserRole, ApprovalStatus } from '@prisma/client';

/**
 * IApprovalWorkflow — Multi-step approval orchestration
 * SRP: creates, advances, and completes multi-step approval workflows.
 * Used when governance rules require human approval before Hermes proceeds.
 */
export interface IApprovalWorkflow {
  create(input: CreateWorkflowInput): Promise<ApprovalWorkflowDescriptor>;
  advance(
    workflowId: string,
    approverId: string,
    decision: ApprovalDecision,
    comment?: string,
  ): Promise<ApprovalWorkflowDescriptor>;
  cancel(workflowId: string, actorId: string, reason?: string): Promise<void>;
  getStatus(
    workflowId: string,
    tenantId: string,
  ): Promise<ApprovalWorkflowDescriptor | null>;
  canApprove(
    workflowId: string,
    approverId: string,
    tenantId: string,
  ): Promise<boolean>;
  getPendingForApprover(
    approverId: string,
    tenantId: string,
  ): Promise<ApprovalWorkflowDescriptor[]>;
  expire(workflowId: string): Promise<void>;
}

export interface CreateWorkflowInput {
  name: string;
  workflowType: ApprovalWorkflowType;
  context: Record<string, unknown>;
  steps: WorkflowStepInput[];
  requesterId: string;
  tenantId: string;
  workspaceId?: string;
  routineRunId?: string;
  expiresAt?: Date;
}

export interface WorkflowStepInput {
  stepOrder: number;
  approverRole: UserRole[];
  approverId?: string;
}

export interface ApprovalWorkflowDescriptor {
  id: string;
  name: string;
  workflowType: ApprovalWorkflowType;
  status: ApprovalStatus;
  currentStep: number;
  context: Record<string, unknown>;
  result?: Record<string, unknown>;
  steps: WorkflowStepDescriptor[];
  requesterId: string;
  tenantId: string;
  workspaceId?: string;
  routineRunId?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface WorkflowStepDescriptor {
  id: string;
  stepOrder: number;
  approverRole: UserRole[];
  approverId?: string;
  status: ApprovalStatus;
  decision?: string;
  comment?: string;
  decidedAt?: Date;
}

export type ApprovalWorkflowType =
  | 'HIRE'
  | 'FIRE'
  | 'REFUND'
  | 'CONTRACT'
  | 'BUDGET'
  | 'VENDOR_PAYMENT'
  | 'DATA_ACCESS'
  | 'CUSTOM';

export type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'SKIPPED';
