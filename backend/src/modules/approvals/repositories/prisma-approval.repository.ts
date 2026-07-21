/**
 * approvals module — Prisma Repository Implementation
 *
 * SOLID:
 * - SRP: Data access only
 * - DIP: Implements IApprovalRepository
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { IApprovalRepository, CreateApprovalRequestInput, ApprovalRequestRecord } from '../interfaces/approval.interface';
import type { ApprovalFeedback } from '../../../shared/types/approvals.types';

@Injectable()
export class PrismaApprovalRepository implements IApprovalRepository {
  private readonly logger = new Logger(PrismaApprovalRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findApprovals(
    tenantId: string,
    status: string,
  ): Promise<unknown[]> {
    return this.prisma.$queryRaw`
      SELECT 
        id,
        title,
        description,
        amount,
        "riskLevel",
        "aiRecommendation",
        deadline
      FROM approval_requests
      WHERE "tenantId" = ${tenantId}
      AND status = ${status}
      ORDER BY "riskLevel" DESC, "createdAt" DESC
    `;
  }

  async findOne(
    approvalId: string,
    tenantId: string,
  ): Promise<ApprovalRequestRecord | null> {
    const row = await this.prisma.approvalRequest.findFirst({
      where: { id: approvalId, tenantId },
    });
    return row as ApprovalRequestRecord | null;
  }

  async insertFeedback(
    tenantId: string,
    feedback: ApprovalFeedback,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO approval_feedback (
        "approvalId",
        "tenantId",
        "userDecision",
        "aiRecommendation",
        "reasoning",
        "isDiscrepancy",
        "createdAt"
      )
      VALUES (
        ${feedback.approvalId},
        ${tenantId},
        ${feedback.userDecision},
        ${feedback.aiRecommendation},
        ${feedback.reasoning},
        ${feedback.isDiscrepancy},
        NOW()
      )
    `;
  }

  async updateApprovalStatus(
    approvalId: string,
    tenantId: string,
    status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'CANCELLED',
    reviewerId?: string,
    rejectionReason?: string,
  ): Promise<void> {
    const now = new Date();
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: now,
    };
    if (reviewerId) updateData.reviewedById = reviewerId;
    if (status === 'APPROVED') updateData.approvedAt = now;
    if (status === 'REJECTED') {
      updateData.rejectedAt = now;
      if (rejectionReason) updateData.rejectionReason = rejectionReason;
    }
    await this.prisma.approvalRequest.updateMany({
      where: { id: approvalId, tenantId },
      data: updateData,
    });
  }

  async create(
    tenantId: string,
    input: CreateApprovalRequestInput,
  ): Promise<ApprovalRequestRecord> {
    const created = await this.prisma.approvalRequest.create({
      data: {
        tenantId,
        title: input.title,
        description: input.description,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        priority: input.priority ?? 'MEDIUM',
        requestedById: input.requestedById,
        expiresAt: input.expiresAt,
        requiredRole: input.requiredRole,
        payload: (input.payload ?? {}) as object,
        status: 'PENDING',
      },
    });
    return created as ApprovalRequestRecord;
  }
}
