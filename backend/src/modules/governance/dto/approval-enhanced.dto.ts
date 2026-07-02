/**
 * ApprovalEnhancedDto
 *
 * SRP: Represents a complete approval with risk stratification & AI insights
 * Returned by new /approvals/stratified endpoint
 *
 * SOLID: Aggregates enriched data without changing core approval logic
 */

import { AiRecommendationDto } from './ai-recommendation.dto';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BusinessImpact = 'MINOR' | 'STANDARD' | 'SIGNIFICANT' | 'STRATEGIC';
export type BatchGroup = 'ROUTINE' | 'STRATEGIC' | 'MIXED';

export interface IUserPreview {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
}

export interface IApprovalEnhanced {
    // Core fields (from ApprovalRequest)
    id: string;
    title: string;
    description?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'CANCELLED';
    createdAt: Date;

    // Risk & Impact
    riskLevel: RiskLevel;
    businessImpact: BusinessImpact;
    amount?: number;

    // AI Recommendation
    aiRecommendation: AiRecommendationDto;

    // Context
    requester?: IUserPreview;
    resourceType?: string;
    resourceId?: string;

    // Batch handling
    batchGroup?: BatchGroup;
    canBatchApprove?: boolean;
}

export class ApprovalEnhancedDto implements IApprovalEnhanced {
    id!: string;
    title!: string;
    description?: string;
    status!: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'CANCELLED';
    createdAt!: Date;

    riskLevel!: RiskLevel;
    businessImpact!: BusinessImpact;
    amount?: number;

    aiRecommendation!: AiRecommendationDto;
    requester?: IUserPreview;
    resourceType?: string;
    resourceId?: string;

    batchGroup?: BatchGroup;
    canBatchApprove?: boolean;

    constructor(data: IApprovalEnhanced) {
        this.id = data.id;
        this.title = data.title;
        this.description = data.description;
        this.status = data.status;
        this.createdAt = data.createdAt;
        this.riskLevel = data.riskLevel;
        this.businessImpact = data.businessImpact;
        this.amount = data.amount;
        this.aiRecommendation = data.aiRecommendation;
        this.requester = data.requester;
        this.resourceType = data.resourceType;
        this.resourceId = data.resourceId;
        this.batchGroup = data.batchGroup;
        this.canBatchApprove = data.canBatchApprove;
    }

    /**
     * Determines if this approval can be batch approved
     * (must be ROUTINE batch group AND high confidence)
     */
    canBatch(): boolean {
        return (
            this.batchGroup === 'ROUTINE' &&
            this.aiRecommendation.isHighConfidence(80)
        );
    }

    /**
     * Returns risk color for UI (Tailwind class-friendly)
     */
    getRiskColor(): string {
        switch (this.riskLevel) {
            case 'CRITICAL':
                return 'red';
            case 'HIGH':
                return 'orange';
            case 'MEDIUM':
                return 'yellow';
            case 'LOW':
                return 'green';
            default:
                return 'gray';
        }
    }
}
