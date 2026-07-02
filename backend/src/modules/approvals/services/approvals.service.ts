/**
 * src/modules/approvals/services/approvals.service.ts
 *
 * Business logic for approval processing and learning
 * SOLID:
 * - SRP: Handles approval stratification and feedback only
 * - OCP: Methods extensible without modification
 * - DIP: Depends on PrismaService abstraction
 */

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
    ApprovalRequest,
    StratifiedApprovalsResponse,
    ApprovalFeedback,
} from '../../../shared/types/approvals.types';

/**
 * ApprovalsService
 * Handles approval stratification and learning feedback
 *
 * SOLID:
 * - SRP: Only handles approvals
 * - OCP: Methods can be extended
 * - DIP: Depends on PrismaService
 */
@Injectable()
export class ApprovalsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get stratified approvals for a tenant
     * Separates critical from routine approvals
     *
     * SOLID: SRP - Only approval stratification
     *
     * @param tenantId - Tenant ID
     * @param status - Filter by status
     * @returns Stratified approvals response
     */
    async getStratifiedApprovals(
        tenantId: string,
        status: string = 'PENDING'
    ): Promise<StratifiedApprovalsResponse> {
        if (!tenantId) {
            throw new HttpException(
                'Tenant ID is required',
                HttpStatus.BAD_REQUEST
            );
        }

        try {
            // Fetch all approvals
            const approvals = await this.prisma.$queryRaw`
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

            // Stratify by risk level
            const critical = (approvals as any[])
                ?.filter(
                    a =>
                        a.riskLevel === 'CRITICAL' || a.riskLevel === 'HIGH'
                )
                .map(a => this.transformApproval(a)) || [];

            const routine = (approvals as any[])
                ?.filter(
                    a =>
                        a.riskLevel === 'MEDIUM' || a.riskLevel === 'LOW'
                )
                .map(a => this.transformApproval(a)) || [];

            return {
                critical,
                routine,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            console.error('[ApprovalsService.getStratifiedApprovals] Error:', error);
            throw new HttpException(
                'Failed to fetch approvals',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Submit feedback for an approval decision
     * Records discrepancies for model learning
     *
     * SOLID: SRP - Only feedback submission
     *
     * @param tenantId - Tenant ID
     * @param feedback - Feedback data
     */
    async submitFeedback(
        tenantId: string,
        feedback: ApprovalFeedback
    ): Promise<void> {
        try {
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

            console.log(
                `[ApprovalsService] Feedback submitted for approval ${feedback.approvalId}`
            );
        } catch (error) {
            console.error('[ApprovalsService.submitFeedback] Error:', error);
            throw new HttpException(
                'Failed to submit feedback',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Approve an approval request
     * SOLID: SRP - Only approval logic
     *
     * @param tenantId - Tenant ID
     * @param approvalId - Approval ID
     */
    async approveRequest(
        tenantId: string,
        approvalId: string
    ): Promise<void> {
        try {
            await this.prisma.$executeRaw`
                UPDATE approval_requests
                SET status = 'APPROVED', "updatedAt" = NOW()
                WHERE id = ${approvalId} AND "tenantId" = ${tenantId}
            `;
        } catch (error) {
            console.error('[ApprovalsService.approveRequest] Error:', error);
            throw new HttpException(
                'Failed to approve request',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Reject an approval request
     * SOLID: SRP - Only rejection logic
     *
     * @param tenantId - Tenant ID
     * @param approvalId - Approval ID
     */
    async rejectRequest(
        tenantId: string,
        approvalId: string
    ): Promise<void> {
        try {
            await this.prisma.$executeRaw`
                UPDATE approval_requests
                SET status = 'REJECTED', "updatedAt" = NOW()
                WHERE id = ${approvalId} AND "tenantId" = ${tenantId}
            `;
        } catch (error) {
            console.error('[ApprovalsService.rejectRequest] Error:', error);
            throw new HttpException(
                'Failed to reject request',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Transform approval record to API format
     * SOLID: SRP - Only transformation logic
     *
     * @param approval - Raw approval record
     * @returns Transformed approval
     */
    private transformApproval(approval: any): ApprovalRequest {
        return {
            id: approval.id,
            title: approval.title,
            description: approval.description,
            amount: approval.amount,
            riskLevel: approval.riskLevel,
            aiRecommendation:
                typeof approval.aiRecommendation === 'string'
                    ? JSON.parse(approval.aiRecommendation)
                    : approval.aiRecommendation,
            deadline: approval.deadline,
        };
    }
}
