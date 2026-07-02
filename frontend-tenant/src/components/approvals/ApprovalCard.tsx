/**
 * ApprovalCard.tsx
 *
 * Composite component that brings together all approval UI elements
 * Shows: Risk badge, confidence, evidence boxes, historical context, and actions
 *
 * SOLID: Composition over inheritance
 * - Uses smaller focused components
 * - Coordinates their layout
 * - Handles user interactions
 */

'use client';

import type { FC } from 'react';
import { useState } from 'react';
import { RiskBadge, type RiskLevel } from './RiskBadge';
import { ConfidenceScore } from './ConfidenceScore';
import { EvidenceBox } from './EvidenceBox';
import { SimilarDealsBox } from './SimilarDealsBox';
import { ApprovalSignalDisplay, SignalType } from './ApprovalSignalDisplay';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ApprovalSignal {
    type: SignalType;
    description: string;
    weight: number;
}

interface AiRecommendation {
    action: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'REVIEW';
    confidence: number;
    reasoning: string;
    signals: ApprovalSignal[];
    pastSimilar: {
        count: number;
        approvalRate: number;
        avgOutcome?: string;
    };
}

interface Approval {
    id: string;
    title: string;
    description?: string;
    riskLevel: RiskLevel;
    amount?: number;
    aiRecommendation: AiRecommendation;
    canBatchApprove?: boolean;
}

interface ApprovalCardProps {
    approval: Approval;
    onApprove: (id: string) => Promise<void>;
    onReject: (id: string) => Promise<void>;
    onEscalate: (id: string) => Promise<void>;
    onReview: (id: string) => Promise<void>;
    isLoading?: boolean;
    className?: string;
}

export const ApprovalCard: FC<ApprovalCardProps> = ({
    approval,
    onApprove,
    onReject,
    onEscalate,
    onReview,
    isLoading,
    className,
}) => {
    const [isActionLoading, setIsActionLoading] = useState(false);

    const handleAction = async (
        action: () => Promise<void>,
    ) => {
        try {
            setIsActionLoading(true);
            await action();
        } finally {
            setIsActionLoading(false);
        }
    };

    const isDisabled = isLoading || isActionLoading;

    return (
        <div
            className={cn(
                'approval-card p-4 border rounded-lg bg-white hover:shadow-md transition-shadow',
                className,
            )}
            role="article"
            aria-label={`Approval: ${approval.title}`}
        >
            {/* HEADER */}
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-2">
                        <RiskBadge level={approval.riskLevel} />
                        {approval.canBatchApprove && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                                Batch-Ready
                            </span>
                        )}
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900">
                        {approval.title}
                    </h3>
                    {approval.description && (
                        <p className="text-sm text-gray-600 mt-1">{approval.description}</p>
                    )}
                    {approval.amount && (
                        <p className="text-sm text-gray-500 mt-1">
                            Amount: ${(approval.amount / 1000).toFixed(1)}K
                        </p>
                    )}
                </div>

                {/* CONFIDENCE SCORE */}
                <div className="flex-shrink-0">
                    <ConfidenceScore
                        score={approval.aiRecommendation.confidence}
                        reasoning={approval.aiRecommendation.reasoning}
                    />
                </div>
            </div>

            {/* EVIDENCE SECTION */}
            <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                <EvidenceBox
                    signals={approval.aiRecommendation.signals}
                    type={SignalType.POSITIVE}
                />
                <EvidenceBox
                    signals={approval.aiRecommendation.signals}
                    type={SignalType.NEGATIVE}
                />
                <EvidenceBox
                    signals={approval.aiRecommendation.signals}
                    type={SignalType.UNKNOWN}
                />
            </div>

            {/* HISTORICAL CONTEXT */}
            <div className="mb-4 pb-4 border-b border-gray-200">
                <SimilarDealsBox past={approval.aiRecommendation.pastSimilar} />
            </div>

            {/* AI RECOMMENDATION SUMMARY */}
            <div className="mb-4 p-3 rounded bg-blue-50 border border-blue-200">
                <p className="text-sm">
                    <span className="font-semibold text-gray-900">
                        AI Recommendation:
                    </span>{' '}
                    <span className="text-gray-700">{approval.aiRecommendation.action}</span>
                </p>
                <p className="text-xs text-gray-600 mt-1">
                    {approval.aiRecommendation.reasoning}
                </p>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-2 flex-wrap">
                <Button
                    variant="default"
                    size="sm"
                    onClick={() =>
                        handleAction(() => onApprove(approval.id))
                    }
                    disabled={isDisabled}
                    className="flex-grow"
                >
                    {isActionLoading ? 'Processing...' : 'Approve'}
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        handleAction(() => onReview(approval.id))
                    }
                    disabled={isDisabled}
                >
                    Review
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        handleAction(() => onEscalate(approval.id))
                    }
                    disabled={isDisabled}
                >
                    Escalate
                </Button>

                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                        handleAction(() => onReject(approval.id))
                    }
                    disabled={isDisabled}
                >
                    Reject
                </Button>
            </div>
        </div>
    );
};
