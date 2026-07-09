/**
 * approvals module — Prisma Repository Implementation
 *
 * SOLID:
 * - SRP: Data access only
 * - DIP: Implements IApprovalRepository
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { IApprovalRepository } from '../interfaces/approval.interface';
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
    status: 'APPROVED' | 'REJECTED',
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE approval_requests
      SET status = ${status}, "updatedAt" = NOW()
      WHERE id = ${approvalId} AND "tenantId" = ${tenantId}
    `;
  }
}
