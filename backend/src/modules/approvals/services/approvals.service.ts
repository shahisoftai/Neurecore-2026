/**
 * src/modules/approvals/services/approvals.service.ts
 *
 * Business logic for approval processing and learning
 * SOLID:
 * - SRP: Handles approval stratification and feedback only
 * - OCP: Methods extensible without modification
 * - DIP: Depends on IApprovalRepository abstraction
 */

import { Injectable, HttpException, HttpStatus, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type {
    ApprovalRequest,
    StratifiedApprovalsResponse,
    ApprovalFeedback,
} from '../../../shared/types/approvals.types';
import type {
  IApprovalRepository,
  IApprovalsService,
  CreateApprovalRequestInput,
  ApprovalRequestRecord,
} from '../interfaces/approval.interface';
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
        approvalId: string,
        reviewerId?: string,
    ): Promise<void> {
        if (!tenantId) throw new BadRequestException('Tenant ID required');
        if (!approvalId) throw new BadRequestException('Approval ID required');
        try {
            await this.repository.updateApprovalStatus(approvalId, tenantId, 'APPROVED', reviewerId);
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
        approvalId: string,
        reviewerId?: string,
        reason?: string,
    ): Promise<void> {
        if (!tenantId) throw new BadRequestException('Tenant ID required');
        if (!approvalId) throw new BadRequestException('Approval ID required');
        try {
            await this.repository.updateApprovalStatus(approvalId, tenantId, 'REJECTED', reviewerId, reason);
        } catch (error) {
            this.logger.error('Failed to reject request', error);
            throw new HttpException(
                'Failed to reject request',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async create(
        tenantId: string,
        input: CreateApprovalRequestInput,
    ): Promise<ApprovalRequestRecord> {
        if (!tenantId) throw new BadRequestException('Tenant ID required');
        if (!input.title) throw new BadRequestException('Title required');
        if (!input.resourceType) throw new BadRequestException('Resource type required');
        const created = await this.repository.create(tenantId, input);
        this.logger.log(`Created approval request ${created.id} (${input.resourceType}) for tenant ${tenantId}`);
        return created;
    }

    async findOne(
        approvalId: string,
        tenantId: string,
    ): Promise<ApprovalRequestRecord | null> {
        if (!tenantId) throw new BadRequestException('Tenant ID required');
        return this.repository.findOne(approvalId, tenantId);
    }

    async resubmit(
        tenantId: string,
        approvalId: string,
    ): Promise<ApprovalRequestRecord> {
        if (!tenantId) throw new BadRequestException('Tenant ID required');
        const existing = await this.repository.findOne(approvalId, tenantId);
        if (!existing) throw new NotFoundException(`Approval ${approvalId} not found`);
        if (existing.status !== 'REJECTED' && existing.status !== 'CANCELLED') {
            throw new BadRequestException(
                `Cannot resubmit approval in status ${existing.status}`,
            );
        }
        await this.repository.updateApprovalStatus(approvalId, tenantId, 'PENDING');
        const refreshed = await this.repository.findOne(approvalId, tenantId);
        return refreshed as ApprovalRequestRecord;
    }

    async cancel(
        tenantId: string,
        approvalId: string,
    ): Promise<void> {
        if (!tenantId) throw new BadRequestException('Tenant ID required');
        const existing = await this.repository.findOne(approvalId, tenantId);
        if (!existing) throw new NotFoundException(`Approval ${approvalId} not found`);
        await this.repository.updateApprovalStatus(approvalId, tenantId, 'CANCELLED');
    }

    async bulkApprove(
        tenantId: string,
        approvalIds: string[],
        reviewerId?: string,
    ): Promise<Array<{ id: string; status: 'approved' | 'failed'; error?: string }>> {
        const results: Array<{ id: string; status: 'approved' | 'failed'; error?: string }> = [];
        for (const id of approvalIds) {
            try {
                const existing = await this.repository.findOne(id, tenantId);
                if (!existing) {
                    results.push({ id, status: 'failed', error: 'Not found' });
                    continue;
                }
                if (existing.status !== 'PENDING') {
                    results.push({ id, status: 'failed', error: `Cannot approve in status ${existing.status}` });
                    continue;
                }
                await this.approveRequest(tenantId, id, reviewerId);
                results.push({ id, status: 'approved' });
            } catch (err) {
                results.push({
                    id,
                    status: 'failed',
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return results;
    }

    async bulkReject(
        tenantId: string,
        approvalIds: string[],
        reviewerId?: string,
        reason?: string,
    ): Promise<Array<{ id: string; status: 'rejected' | 'failed'; error?: string }>> {
        const results: Array<{ id: string; status: 'rejected' | 'failed'; error?: string }> = [];
        for (const id of approvalIds) {
            try {
                const existing = await this.repository.findOne(id, tenantId);
                if (!existing) {
                    results.push({ id, status: 'failed', error: 'Not found' });
                    continue;
                }
                if (existing.status !== 'PENDING') {
                    results.push({ id, status: 'failed', error: `Cannot reject in status ${existing.status}` });
                    continue;
                }
                await this.rejectRequest(tenantId, id, reviewerId, reason);
                results.push({ id, status: 'rejected' });
            } catch (err) {
                results.push({
                    id,
                    status: 'failed',
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return results;
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
