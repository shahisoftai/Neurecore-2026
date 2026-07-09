/**
 * src/modules/approvals/services/approvals.service.ts
 *
 * Business logic for approval processing and learning
 * SOLID:
 * - SRP: Handles approval stratification and feedback only
 * - OCP: Methods extensible without modification
 * - DIP: Depends on IApprovalRepository abstraction
 */

import { Injectable, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common';
import type {
    ApprovalRequest,
    StratifiedApprovalsResponse,
    ApprovalFeedback,
} from '../../../shared/types/approvals.types';
import type { IApprovalRepository, IApprovalsService } from '../interfaces/approval.interface';
import { APPROVAL_REPOSITORY } from '../interfaces/approval.interface';

@Injectable()
export class ApprovalsService implements IApprovalsService {
    private readonly logger = new Logger(ApprovalsService.name);

    constructor(
        @Inject(APPROVAL_REPOSITORY)
        private readonly repository: IApprovalRepository,
    ) { }

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
            const approvals = await this.repository.findApprovals(tenantId, status);

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
            this.logger.error('Failed to fetch approvals', error);
            throw new HttpException(
                'Failed to fetch approvals',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async submitFeedback(
        tenantId: string,
        feedback: ApprovalFeedback
    ): Promise<void> {
        try {
            await this.repository.insertFeedback(tenantId, feedback);

            this.logger.log(
                `Feedback submitted for approval ${feedback.approvalId}`
            );
        } catch (error) {
            this.logger.error('Failed to submit feedback', error);
            throw new HttpException(
                'Failed to submit feedback',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async approveRequest(
        tenantId: string,
        approvalId: string
    ): Promise<void> {
        try {
            await this.repository.updateApprovalStatus(approvalId, tenantId, 'APPROVED');
        } catch (error) {
            this.logger.error('Failed to approve request', error);
            throw new HttpException(
                'Failed to approve request',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async rejectRequest(
        tenantId: string,
        approvalId: string
    ): Promise<void> {
        try {
            await this.repository.updateApprovalStatus(approvalId, tenantId, 'REJECTED');
        } catch (error) {
            this.logger.error('Failed to reject request', error);
            throw new HttpException(
                'Failed to reject request',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

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
