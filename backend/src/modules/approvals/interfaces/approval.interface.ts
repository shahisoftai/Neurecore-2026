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

export interface CreateApprovalRequestInput {
  title: string;
  description?: string;
  resourceType: string;
  resourceId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requestedById?: string;
  payload?: Record<string, unknown>;
  expiresAt?: Date;
  requiredRole?: string;
}

export interface ApprovalRequestRecord {
  id: string;
  title: string;
  description: string | null;
  resourceType: string;
  resourceId: string | null;
  status: string;
  priority: string;
  tenantId: string;
  requestedById: string | null;
  reviewedById: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IApprovalRepository {
  findApprovals(
    tenantId: string,
    status: string,
  ): Promise<unknown[]>;

  findOne(
    approvalId: string,
    tenantId: string,
  ): Promise<ApprovalRequestRecord | null>;

  insertFeedback(
    tenantId: string,
    feedback: ApprovalFeedback,
  ): Promise<void>;

  updateApprovalStatus(
    approvalId: string,
    tenantId: string,
    status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'CANCELLED',
    reviewerId?: string,
    rejectionReason?: string,
  ): Promise<void>;

  create(
    tenantId: string,
    input: CreateApprovalRequestInput,
  ): Promise<ApprovalRequestRecord>;
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
    reviewerId?: string,
  ): Promise<void>;

  rejectRequest(
    tenantId: string,
    approvalId: string,
    reviewerId?: string,
    reason?: string,
  ): Promise<void>;

  create(
    tenantId: string,
    input: CreateApprovalRequestInput,
  ): Promise<ApprovalRequestRecord>;

  findOne(
    approvalId: string,
    tenantId: string,
  ): Promise<ApprovalRequestRecord | null>;

  resubmit(
    tenantId: string,
    approvalId: string,
  ): Promise<ApprovalRequestRecord>;

  cancel(
    tenantId: string,
    approvalId: string,
  ): Promise<void>;

  bulkApprove(
    tenantId: string,
    approvalIds: string[],
    reviewerId?: string,
  ): Promise<Array<{ id: string; status: 'approved' | 'failed'; error?: string }>>;

  bulkReject(
    tenantId: string,
    approvalIds: string[],
    reviewerId?: string,
    reason?: string,
  ): Promise<Array<{ id: string; status: 'rejected' | 'failed'; error?: string }>>;
}

export const APPROVAL_REPOSITORY = 'APPROVAL_REPOSITORY';
