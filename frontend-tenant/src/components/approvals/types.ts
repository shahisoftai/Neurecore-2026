/**
 * src/components/approvals/types.ts - Frontend approval component types
 *
 * SOLID: ISP - Separate interfaces for different concerns
 */

/**
 * AI recommendation signal
 * SOLID: ISP - Only signal-related fields
 */
export interface SignalData {
    type: 'POSITIVE' | 'NEGATIVE' | 'UNKNOWN' | 'RISK';
    weight: number; // 0-100
    description: string;
}

/**
 * Past similar deals reference
 * SOLID: ISP - Only historical data fields
 */
export interface PastSimilarRef {
    count: number;
    approvalRate: number; // 0-1
    avgDealSize?: number;
}

/**
 * AI recommendation for an approval
 * SOLID: ISP - Only recommendation-related fields
 */
export interface AIRecommendation {
    action: 'APPROVE' | 'REJECT' | 'REVIEW';
    confidence: number; // 0-100
    reasoning: string;
    signals: SignalData[];
    pastSimilar?: PastSimilarRef;
}

/**
 * Props for ApprovalCard component
 * SOLID: SRP - Only card-related props
 */
export interface ApprovalCardProps {
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
    onApprove?: () => void;
    onReject?: () => void;
    onReview?: () => void;
}

/**
 * Props for BatchApprovalView component
 * SOLID: ISP - Only batch view-related props
 */
export interface BatchApprovalViewProps {
    critical: ApprovalCardProps[];
    routine: ApprovalCardProps[];
    isLoading?: boolean;
    onApprovalAction?: (approvalId: string, action: 'approve' | 'reject' | 'review') => void;
    onFeedbackClick?: (approvalId: string, aiAction: string, userAction: string) => void;
}

/**
 * Props for LearningFeedbackModal component
 * SOLID: ISP - Only feedback-related props
 */
export interface LearningFeedbackModalProps {
    isOpen: boolean;
    approvalId: string;
    title: string;
    aiRecommendation: AIRecommendation;
    userDecision: 'approve' | 'reject' | 'review';
    onSubmit?: (feedbackData: {
        approvalId: string;
        userDecision: 'approve' | 'reject' | 'review';
        aiRecommendation: string;
        reasoning: string;
        isDiscrepancy: boolean;
    }) => Promise<void>;
    onClose?: () => void;
    isSubmitting?: boolean;
}
