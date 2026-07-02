/**
 * /src/app/service-desk/approvals-hub/page.tsx
 *
 * Risk-Stratified Approvals Page (Phase 1)
 *
 * SOLID:
 * - Container component that orchestrates sub-components
 * - Uses custom hooks for data fetching
 * - Manages loading/error states
 * - Uses Zustand store for state management
 * - Feature-flagged: APPROVALS_V2 environment variable
 */

'use client';

import { useEffect } from 'react';
import { ApprovalHub } from '@/components/approvals';
import { useApprovalStore } from '@/stores/approvalStore';
import {
    getStratifiedApprovals,
    approveApproval,
    rejectApproval,
    escalateApproval,
    submitApprovalFeedback,
} from '@/services/approval-enrichment.service';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

export default function ApprovalsHubPage() {
    const {
        approvals,
        isLoading,
        error,
        setApprovals,
        setLoading,
        setError,
    } = useApprovalStore();

    // Fetch approvals on mount
    useEffect(() => {
        const fetchApprovals = async () => {
            try {
                setLoading(true);
                const data = await getStratifiedApprovals('PENDING', 50);
                setApprovals(data);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : 'Failed to fetch approvals',
                );
            }
        };

        fetchApprovals();
    }, [setApprovals, setLoading, setError]);

    // Handle approval
    const handleApprove = async (id: string) => {
        try {
            await approveApproval(id);
            // Submit feedback for learning
            await submitApprovalFeedback(id, {
                userDecision: 'APPROVED',
                aiRecommendation: 'APPROVE',
                reason: 'user_approved',
            });
            // Refetch approvals
            const data = await getStratifiedApprovals('PENDING', 50);
            setApprovals(data);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Failed to approve request',
            );
        }
    };

    // Handle rejection
    const handleReject = async (id: string) => {
        try {
            // TODO: Show dialog to collect rejection reason
            await rejectApproval(id);
            // Submit feedback for learning
            await submitApprovalFeedback(id, {
                userDecision: 'REJECTED',
                aiRecommendation: 'APPROVE',
                reason: 'user_rejected',
            });
            // Refetch approvals
            const data = await getStratifiedApprovals('PENDING', 50);
            setApprovals(data);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Failed to reject request',
            );
        }
    };

    // Handle escalation
    const handleEscalate = async (id: string) => {
        try {
            await escalateApproval(id);
            // Refetch approvals
            const data = await getStratifiedApprovals('PENDING', 50);
            setApprovals(data);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Failed to escalate request',
            );
        }
    };

    // Handle review (view details)
    const handleReview = async (_id: string) => {
        // TODO: Open details modal or navigate to detail page
        console.log('Review approval:', _id);
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-4 p-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="p-6">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-red-900">Error loading approvals</h3>
                            <p className="text-sm text-red-800 mt-1">{error}</p>
                            <button
                                onClick={() => {
                                    setError(null);
                                    window.location.reload();
                                }}
                                className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // No data
    if (!approvals) {
        return (
            <div className="p-6 text-center text-gray-500">
                No approval data available
            </div>
        );
    }

    // Render approvals hub
    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">
                    Risk-Stratified Approvals
                </h1>
                <p className="text-gray-600 mt-1">
                    AI-powered approval prioritization with confidence scoring
                </p>
            </div>

            <ApprovalHub
                approvals={approvals}
                onApprove={handleApprove}
                onReject={handleReject}
                onEscalate={handleEscalate}
                onReview={handleReview}
                isLoading={isLoading}
            />
        </div>
    );
}
