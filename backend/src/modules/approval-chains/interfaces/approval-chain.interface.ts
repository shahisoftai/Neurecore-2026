/**
 * approval-chains module — Interface Definitions
 *
 * Phase 4: Approval chain resolution based on risk tier.
 * Ordered, sequential approval steps filtered by deliverable risk tier.
 *
 * SOLID: Interface Segregation, Dependency Inversion.
 */

import type { ApprovalWorkflow, ApprovalWorkflowStep } from '@prisma/client';

export type ApprovalWorkflowStepWithChain = {
  id: string;
  approvalWorkflowId: string;
  stepOrder: number;
  approverRole: string[];
  approverId: string | null;
  status: string;
  decision: string | null;
  comment: string | null;
  decidedAt: Date | null;
  chainStepOrder: number;
  chainStepTotal: number;
  blockedByPriorStep: boolean;
};

export type ApprovalWorkflowWithSteps = {
  id: string;
  name: string;
  description: string | null;
  workflowType: string;
  currentStep: number;
  status: string;
  riskTier: string | null;
  targetDeliverableId: string | null;
  steps: ApprovalWorkflowStepWithChain[];
  createdAt: Date;
  updatedAt: Date;
};

export interface ResolveApprovalChainInput {
  deliverableId: string;
  projectTypeVersionApprovalTemplate: ApprovalStepTemplate[];
  currentRiskTier: string;
}

export interface ApprovalStepTemplate {
  stepOrder: number;
  approverRole: string;
  riskTier?: string;
  chainStepOrder?: number;
  chainStepTotal?: number;
}

export interface ApprovalChainResolution {
  workflowId: string;
  steps: ApprovalWorkflowStepWithChain[];
  isSequential: boolean;
  totalSteps: number;
}

export const APPROVAL_CHAINS_SERVICE = 'APPROVAL_CHAINS_SERVICE';

export interface IApprovalChainRepository {
  findProjectTypeVersionById(
    projectTypeVersionId: string,
  ): Promise<{ approvalTemplate: unknown } | null>;

  /**
   * Tenant-scoped: returns null when the workflow exists but belongs to
   * another tenant. Throws NotFoundException only when the row genuinely does
   * not exist for the calling tenant.
   */
  findWorkflowById(
    workflowId: string,
    tenantId: string,
  ): Promise<(ApprovalWorkflow & { steps: ApprovalWorkflowStep[] }) | null>;

  /**
   * Tenant-scoped update. If the workflow belongs to another tenant the
   * operation must not match any row (Prisma will surface this as
   * P2025/RecordNotFound, which the service translates to 404).
   */
  updateWorkflow(
    workflowId: string,
    tenantId: string,
    data: { status?: 'APPROVED'; completedAt?: Date; currentStep?: number },
  ): Promise<void>;

  /**
   * Tenant-scoped: returns null for cross-tenant access.
   */
  findStepWithWorkflow(
    stepId: string,
    tenantId: string,
  ): Promise<
    | (ApprovalWorkflowStep & {
        approvalWorkflow: ApprovalWorkflow & { steps: ApprovalWorkflowStep[] };
      })
    | null
  >;

  findWorkflows(
    tenantId: string,
    options: { status?: string[]; riskTier?: string },
  ): Promise<(ApprovalWorkflow & { steps: ApprovalWorkflowStep[] })[]>;
}

export const APPROVAL_CHAIN_REPOSITORY = 'APPROVAL_CHAIN_REPOSITORY';

export interface IApprovalChainsService {
  resolveChain(
    tenantId: string,
    deliverableId: string,
    projectTypeVersionId: string,
  ): Promise<ApprovalChainResolution>;
  advanceChain(tenantId: string, workflowId: string): Promise<void>;
  isStepBlocked(tenantId: string, stepId: string): Promise<boolean>;
  findPendingWorkflows(
    tenantId: string,
    riskTier?: string,
  ): Promise<(ApprovalWorkflow & { steps: ApprovalWorkflowStep[] })[]>;
  getCurrentStep(
    tenantId: string,
    workflowId: string,
  ): Promise<ApprovalWorkflowStepWithChain | null>;
}

