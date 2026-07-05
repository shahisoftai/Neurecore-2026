/**
 * src/hooks/useApprovals.ts
 *
 * React hook for approval data fetching with batch processing
 * SOLID:
 * - SRP: Only handles approval data fetching and state
 * - DIP: Depends on restClient service
 */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { restClient } from '@/core/services/api/clients/RestClient';
import type {
    ApprovalRequest,
    StratifiedApprovalsResponse,
    ApprovalsQueryOptions,
    ApprovalFeedback,
} from '@/types/approvals.types';

/**
 * Return type for useApprovals hook
 * SOLID: ISP - Only needed fields
 */
export interface UseApprovalsReturn {
    critical: ApprovalRequest[];
    routine: ApprovalRequest[];
    isLoading: boolean;
    error: string | null;
    submitFeedback: (feedback: ApprovalFeedback) => Promise<void>;
    refetch: () => Promise<void>;
}

/**
 * useApprovals Hook
 * SOLID: SRP - Only handles approval data fetching
 *
 * Features:
 * - Fetches stratified approvals (critical vs routine)
 * - Error handling and retry
 * - Feedback submission
 * - Memoized returns
 *
 * Usage:
 * const { critical, routine, submitFeedback } = useApprovals();
 */
export const useApprovals = (options?: {
    autoRefresh?: boolean;
    refreshInterval?: number;
}): UseApprovalsReturn => {
    const [critical, setCritical] = useState<ApprovalRequest[]>([]);
    const [routine, setRoutine] = useState<ApprovalRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const autoRefresh = options?.autoRefresh ?? false;
    const refreshInterval = options?.refreshInterval ?? 60000; // 60s default

    /**
     * Fetch stratified approvals
     * SOLID: SRP - Only data fetching
     */
    const fetchApprovals = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response =
                await restClient.get<StratifiedApprovalsResponse>(
                    '/approvals/stratified?status=PENDING'
                );

            // Extract data from API response wrapper
            const approvalsData = response.data;

            if (approvalsData) {
                setCritical(approvalsData.critical);
                setRoutine(approvalsData.routine);
            } else {
                setError('Failed to fetch approvals');
            }
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useApprovals] Error:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Initial fetch on mount
     */
    useEffect(() => {
        fetchApprovals();
    }, [fetchApprovals]);

    /**
     * Auto-refresh effect
     * SOLID: SRP - Only manages refresh interval
     */
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(fetchApprovals, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchApprovals, autoRefresh, refreshInterval]);

    /**
     * Submit feedback for learning
     * SOLID: SRP - Only feedback submission
     */
    const submitFeedback = useCallback(async (feedback: ApprovalFeedback) => {
        try {
            await restClient.post('/approvals/feedback', feedback);
            console.log('[useApprovals] Feedback submitted successfully');
        } catch (err) {
            console.error('[useApprovals] Feedback submission error:', err);
            throw err;
        }
    }, []);

    const total = useMemo(
        () => (Array.isArray(critical) ? critical.length : 0)
              + (Array.isArray(routine) ? routine.length : 0),
        [critical, routine]
    );

    return {
        critical,
        routine,
        isLoading,
        error,
        submitFeedback,
        refetch: fetchApprovals,
    };
};
