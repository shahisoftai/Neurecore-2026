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

  findWorkflowById(
    workflowId: string,
  ): Promise<(ApprovalWorkflow & { steps: ApprovalWorkflowStep[] }) | null>;

  updateWorkflow(
    workflowId: string,
    data: { status?: 'APPROVED'; completedAt?: Date; currentStep?: number },
  ): Promise<void>;

  findStepWithWorkflow(
    stepId: string,
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
    deliverableId: string,
    projectTypeVersionId: string,
    riskTier: string,
  ): Promise<ApprovalChainResolution>;
  advanceChain(workflowId: string): Promise<void>;
  isStepBlocked(stepId: string): Promise<boolean>;
  findPendingWorkflows(
    tenantId: string,
    riskTier?: string,
  ): Promise<(ApprovalWorkflow & { steps: ApprovalWorkflowStep[] })[]>;
  getCurrentStep(
    workflowId: string,
  ): Promise<ApprovalWorkflowStepWithChain | null>;
}

