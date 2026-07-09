/**
 * approval-chains.service.ts — Phase 4: Approval Chains
 *
 * Wraps the backend approval-chains API for the tenant UI.
 */

import api from './api';
import { unwrapItem } from './unwrap';

export type ApprovalStepTemplate = {
  stepOrder: number;
  approverRole: string;
  riskTier?: string;
  chainStepOrder?: number;
  chainStepTotal?: number;
};

export type ApprovalWorkflowStep = {
  id: string;
  approvalWorkflowId: string;
  stepOrder: number;
  approverRole: string[];
  approverId: string | null;
  status: string;
  decision: string | null;
  comment: string | null;
  decidedAt: string | null;
  chainStepOrder: number;
  chainStepTotal: number;
  blockedByPriorStep: boolean;
};

export type ApprovalWorkflow = {
  id: string;
  name: string;
  description: string | null;
  workflowType: string;
  currentStep: number;
  status: string;
  riskTier: string | null;
  targetDeliverableId: string | null;
  steps: ApprovalWorkflowStep[];
  createdAt: string;
  updatedAt: string;
};

export type ApprovalChainResolution = {
  workflowId: string;
  steps: ApprovalWorkflowStep[];
  isSequential: boolean;
  totalSteps: number;
};

export const approvalChainsService = {
  async resolveChain(
    deliverableId: string,
    projectTypeVersionId: string,
  ): Promise<ApprovalChainResolution> {
    const res = await api.post('/approval-chains/resolve', {
      deliverableId,
      projectTypeVersionId,
    });
    return unwrapItem(res) as ApprovalChainResolution;
  },

  async getPendingWorkflows(riskTier?: string): Promise<ApprovalWorkflow[]> {
    const res = await api.get('/approval-chains/pending', {
      params: riskTier ? { riskTier } : {},
    });
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : data;
    return Array.isArray(inner) ? (inner as ApprovalWorkflow[]) : [];
  },

  async getCurrentStep(workflowId: string): Promise<ApprovalWorkflowStep | null> {
    const res = await api.get(`/approval-chains/${workflowId}/current-step`);
    return unwrapItem(res) as ApprovalWorkflowStep | null;
  },

  async isStepBlocked(stepId: string): Promise<boolean> {
    const res = await api.get(`/approval-chains/steps/${stepId}/blocked`);
    return (res as unknown as { blocked: boolean }).blocked ?? false;
  },

  async advanceChain(workflowId: string): Promise<void> {
    await api.post(`/approval-chains/${workflowId}/advance`);
  },
};
