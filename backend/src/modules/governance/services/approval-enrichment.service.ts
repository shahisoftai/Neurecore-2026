/**
 * ApprovalEnrichmentService
 *
 * SRP: Single Responsibility - Enrich approval data with context & AI insights
 * This service fetches context (past approvals, related data) and combines it
 * with scoring to produce enhanced approvals.
 *
 * SOLID: Dependency Injection of Prisma & Scoring service
 *        Open/Closed: Can add more enrichment sources without changing core
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ApprovalScoringService } from './approval-scoring.service';
import {
    ApprovalEnhancedDto,
    RiskLevel,
    BusinessImpact,
} from '../dto/approval-enhanced.dto';
import {
    AiRecommendationDto,
    RecommendationAction,
} from '../dto/ai-recommendation.dto';
import { ApprovalSignalDto, SignalType } from '../dto/approval-signal.dto';
import type { ApprovalStatus } from '@prisma/client';

@Injectable()
export class ApprovalEnrichmentService {
    private readonly logger = new Logger(ApprovalEnrichmentService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly scoring: ApprovalScoringService,
    ) { }

    /**
     * Enrich a single approval with AI insights
     *
     * Process:
     * 1. Fetch related context (requester, resource)
     * 2. Get past similar approvals
     * 3. Generate signals from context
     * 4. Calculate confidence
     * 5. Return enhanced DTO
     */
    async enrichApproval(
        approval: any, // ApprovalRequest from Prisma
        tenantId: string,
    ): Promise<ApprovalEnhancedDto> {
        // Step 1: Determine risk level (placeholder - can be enhanced)
        const riskLevel = this.calculateRiskLevel(approval);
        const businessImpact = this.calculateBusinessImpact(approval);

        // Step 2: Fetch past similar approvals
        const pastSimilar = await this.getPastSimilarApprovals(
            approval.resourceType,
            tenantId,
        );

        // Step 3: Generate signals
        const signals = this.generateSignals(approval, pastSimilar);

        // Step 4: Calculate confidence
        const confidence = this.scoring.calculateConfidence(
            signals,
            pastSimilar.approvalRate,
        );

        // Step 5: Determine action
        const negativeCount = signals.filter(
            (s) => s.type === SignalType.NEGATIVE,
        ).length;
        const action = this.scoring.determineAction(confidence, negativeCount);

        // Step 6: Determine batch group
        const batchGroup = this.scoring.determineBatchGroup(
            riskLevel,
            businessImpact,
            confidence,
        );

        // Step 7: Generate reasoning
        const reasoning = this.scoring.generateReasoning(
            signals,
            pastSimilar.approvalRate,
        );

        // Step 8: Build AI recommendation
        const aiRecommendation = new AiRecommendationDto({
            action,
            confidence,
            reasoning,
            signals,
            pastSimilar,
        });

        // Step 9: Build enhanced approval
        const enhanced = new ApprovalEnhancedDto({
            id: approval.id,
            title: approval.title,
            description: approval.description,
            status: approval.status,
            createdAt: approval.createdAt,
            riskLevel,
            businessImpact,
            amount: approval.payload?.amount as number | undefined,
            aiRecommendation,
            requester: approval.requestedBy
                ? {
                    id: approval.requestedBy.id,
                    firstName: approval.requestedBy.firstName,
                    lastName: approval.requestedBy.lastName,
                    email: approval.requestedBy.email,
                }
                : undefined,
            resourceType: approval.resourceType,
            resourceId: approval.resourceId,
            batchGroup,
            canBatchApprove: batchGroup === 'ROUTINE' && confidence >= 80,
        });

        return enhanced;
    }

    /**
     * Enrich multiple approvals (efficient batch operation)
     */
    async enrichApprovals(
        approvals: any[],
        tenantId: string,
    ): Promise<ApprovalEnhancedDto[]> {
        return Promise.all(
            approvals.map((approval) => this.enrichApproval(approval, tenantId)),
        );
    }

    /**
     * Get approvals stratified by risk level
     * Groups CRITICAL/HIGH first, then MEDIUM/LOW
     *
     * OCP: Can be extended to sort by different criteria
     */
    async getStratifiedApprovals(
        tenantId: string,
        options?: { status?: string; limit?: number },
    ): Promise<{
        critical: ApprovalEnhancedDto[];
        high: ApprovalEnhancedDto[];
        medium: ApprovalEnhancedDto[];
        low: ApprovalEnhancedDto[];
        count: { critical: number; high: number; medium: number; low: number };
    }> {
        const { status = 'PENDING', limit = 50 } = options ?? {};

        // Fetch approvals with properly typed status
        const approvals = await this.prisma.approvalRequest.findMany({
            where: {
                tenantId,
                ...(status ? { status: status as ApprovalStatus } : {}),
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                requestedBy: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        // Enrich all
        const enriched = await this.enrichApprovals(approvals, tenantId);

        // Stratify
        const critical = enriched.filter((a) => a.riskLevel === 'CRITICAL');
        const high = enriched.filter((a) => a.riskLevel === 'HIGH');
        const medium = enriched.filter((a) => a.riskLevel === 'MEDIUM');
        const low = enriched.filter((a) => a.riskLevel === 'LOW');

        return {
            critical,
            high,
            medium,
            low,
            count: {
                critical: critical.length,
                high: high.length,
                medium: medium.length,
                low: low.length,
            },
        };
    }

    // ========== PRIVATE HELPERS ==========

    private calculateRiskLevel(approval: any): RiskLevel {
        // Placeholder implementation
        // Can be enhanced with ML model or business rules
        const priority = approval.priority;

        switch (priority) {
            case 'LOW':
                return 'LOW';
            case 'MEDIUM':
                return 'MEDIUM';
            case 'HIGH':
                return 'HIGH';
            case 'URGENT':
                return 'CRITICAL';
            default:
                return 'MEDIUM';
        }
    }

    private calculateBusinessImpact(approval: any): BusinessImpact {
        // Placeholder implementation
        // Can be enhanced with amount, resource type, etc.
        const amount = approval.payload?.amount as number | undefined;

        if (!amount) return 'STANDARD';
        if (amount < 5000) return 'MINOR';
        if (amount < 50000) return 'STANDARD';
        if (amount < 200000) return 'SIGNIFICANT';
        return 'STRATEGIC';
    }

    private async getPastSimilarApprovals(
        resourceType: string,
        tenantId: string,
    ): Promise<{ count: number; approvalRate: number }> {
        const past = await this.prisma.approvalRequest.findMany({
            where: {
                tenantId,
                resourceType,
                status: { in: ['APPROVED', 'REJECTED'] },
            },
            take: 10,
        });

        if (past.length === 0) {
            return { count: 0, approvalRate: 0.5 }; // Neutral default
        }

        const approvedCount = past.filter(
            (a) => a.status === 'APPROVED',
        ).length;

        return {
            count: past.length,
            approvalRate: approvedCount / past.length,
        };
    }

    private generateSignals(
        approval: any,
        pastSimilar: { count: number; approvalRate: number },
    ): ApprovalSignalDto[] {
        const signals: ApprovalSignalDto[] = [];

        // Signal 1: Budget alignment
        const amount = approval.payload?.amount as number | undefined;
        if (amount && amount > 0) {
            signals.push(
                new ApprovalSignalDto({
                    type: SignalType.POSITIVE,
                    description: `Budget allocated: $${(amount / 1000).toFixed(1)}K`,
                    weight: 60,
                }),
            );
        }

        // Signal 2: Historical success
        if (pastSimilar.count > 0) {
            const rate = pastSimilar.approvalRate;
            if (rate > 0.7) {
                signals.push(
                    new ApprovalSignalDto({
                        type: SignalType.POSITIVE,
                        description: `Strong historical success rate: ${Math.round(rate * 100)}%`,
                        weight: 75,
                    }),
                );
            } else if (rate < 0.3) {
                signals.push(
                    new ApprovalSignalDto({
                        type: SignalType.NEGATIVE,
                        description: `Weak historical success rate: ${Math.round(rate * 100)}%`,
                        weight: 70,
                    }),
                );
            }
        }

        // Signal 3: Missing context
        if (!amount || !approval.description) {
            signals.push(
                new ApprovalSignalDto({
                    type: SignalType.UNKNOWN,
                    description: 'Incomplete information provided',
                    weight: 40,
                }),
            );
        }

        return signals;
    }
}
