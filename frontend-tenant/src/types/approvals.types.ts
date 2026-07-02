/**
 * src/types/approvals.types.ts
 *
 * Frontend shared approval type definitions
 * SOLID: ISP - Segregated interfaces
 */

/**
 * AI recommendation signal
 */
export interface SignalData {
    type: 'POSITIVE' | 'NEGATIVE' | 'UNKNOWN' | 'RISK';
    weight: number; // 0-100
    description: string;
}

/**
 * Past similar deals reference
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
 * Query options for approvals endpoint
 */
export interface ApprovalsQueryOptions {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
    riskLevel?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    limit?: number;
    offset?: number;
}
