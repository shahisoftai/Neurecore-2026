/**
 * approvals module — Interface Definitions
 *
 * SOLID:
 * - ISP: Focused interfaces for repository pattern
 * - DIP: Module depends on abstractions, not Prisma
 */

import type {
  StratifiedApprovalsResponse,
  ApprovalFeedback,
} from '../../../shared/types/approvals.types';

export interface IApprovalRepository {
  findApprovals(
    tenantId: string,
    status: string,
  ): Promise<unknown[]>;

  insertFeedback(
    tenantId: string,
    feedback: ApprovalFeedback,
  ): Promise<void>;

  updateApprovalStatus(
    approvalId: string,
    tenantId: string,
    status: 'APPROVED' | 'REJECTED',
  ): Promise<void>;
}

export interface IApprovalsService {
  getStratifiedApprovals(
    tenantId: string,
    status?: string,
  ): Promise<StratifiedApprovalsResponse>;

  submitFeedback(
    tenantId: string,
    feedback: ApprovalFeedback,
  ): Promise<void>;

  approveRequest(
    tenantId: string,
    approvalId: string,
  ): Promise<void>;

  rejectRequest(
    tenantId: string,
    approvalId: string,
  ): Promise<void>;
}

export const APPROVAL_REPOSITORY = 'APPROVAL_REPOSITORY';
