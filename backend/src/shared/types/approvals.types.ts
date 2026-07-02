/**
 * src/shared/types/approvals.types.ts
 *
 * Shared approval type definitions between frontend and backend
 * SOLID: ISP - Segregated interfaces for different concerns
 */

/**
 * Signal data
 */
export interface SignalData {
    type: 'POSITIVE' | 'NEGATIVE' | 'UNKNOWN' | 'RISK';
    weight: number; // 0-100
    description: string;
}

/**
 * Past similar deals
 */
export interface PastSimilarRef {
    count: number;
    approvalRate: number; // 0-1
    avgDealSize?: number;
}

/**
 * AI recommendation
 */
export interface AIRecommendation {
    action: 'APPROVE' | 'REJECT' | 'REVIEW';
    confidence: number; // 0-100
    reasoning: string;
    signals: SignalData[];
    pastSimilar?: PastSimilarRef;
}

/**
 * Approval request
 */
export interface ApprovalRequest {
    id: string;
    title: string;
    description?: string;
    amount?: number;
    department?: string;
    riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    requester?: {
        name: string;
        email?: string;
    };
    aiRecommendation: AIRecommendation;
    deadline?: string; // ISO 8601
}

/**
 * Stratified approvals response
 */
export interface StratifiedApprovalsResponse {
    critical: ApprovalRequest[];
    routine: ApprovalRequest[];
    timestamp: string;
}

/**
 * Approval feedback
 */
export interface ApprovalFeedback {
    approvalId: string;
    userDecision: 'approve' | 'reject' | 'review';
    aiRecommendation: string;
    reasoning: string;
    isDiscrepancy: boolean;
    timestamp?: string;
}

/**
 * Learning record
 */
export interface LearningRecord {
    approvalId: string;
    userDecision: string;
    aiRecommendation: string;
    userReasoning: string;
    wasDiscrepancy: boolean;
    createdAt: string;
}
