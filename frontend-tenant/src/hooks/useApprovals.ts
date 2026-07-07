/**
 * src/hooks/useApprovals.ts
 *
 * React hook for approval data fetching with shared Zustand store.
 * Multiple hook instances share the same API call — only the first fires the fetch.
 * SOLID:
 * - SRP: Only handles approval data fetching and state
 * - DIP: Depends on restClient service
 */

'use client';

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { restClient } from '@/core/services/api/clients/RestClient';
import { useApprovalsStore } from '@/stores/approvalsStore';
import type {
    ApprovalRequest,
    StratifiedApprovalsResponse,
    ApprovalFeedback,
} from '@/types/approvals.types';

export type { ApprovalRequest };

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

let fetchInFlight: Promise<void> | null = null;

export const useApprovals = (options?: {
    autoRefresh?: boolean;
    refreshInterval?: number;
}): UseApprovalsReturn => {
    const autoRefresh = options?.autoRefresh ?? false;
    const refreshInterval = options?.refreshInterval ?? 60000;

    const critical = useApprovalsStore((s) => s.critical);
    const routine = useApprovalsStore((s) => s.routine);
    const isLoading = useApprovalsStore((s) => s.isLoading);
    const error = useApprovalsStore((s) => s.error);
    const lastFetchedAt = useApprovalsStore((s) => s.lastFetchedAt);
    const setData = useApprovalsStore((s) => s.setData);
    const setError = useApprovalsStore((s) => s.setError);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchApprovals = useCallback(async () => {
        if (fetchInFlight) {
            await fetchInFlight;
            return;
        }

        fetchInFlight = (async () => {
            try {
                const response =
                    await restClient.get<StratifiedApprovalsResponse>(
                        '/approvals/stratified?status=PENDING'
                    );

                const approvalsData = response.data;

                if (approvalsData) {
                    setData(approvalsData.critical, approvalsData.routine);
                } else {
                    setError('Failed to fetch approvals');
                }
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : 'Unknown error';
                setError(message);
                console.error('[useApprovals] Error:', err);
            } finally {
                fetchInFlight = null;
            }
        })();

        await fetchInFlight;
    }, [setData, setError]);

    useEffect(() => {
        if (lastFetchedAt === null) {
            void fetchApprovals();
        }
    }, [fetchApprovals, lastFetchedAt]);

    useEffect(() => {
        if (!autoRefresh) return;

        intervalRef.current = setInterval(() => {
            void fetchApprovals();
        }, refreshInterval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [fetchApprovals, autoRefresh, refreshInterval]);

    const submitFeedback = useCallback(async (feedback: ApprovalFeedback) => {
        try {
            await restClient.post('/approvals/feedback', feedback);
        } catch (err) {
            console.error('[useApprovals] Feedback submission error:', err);
            throw err;
        }
    }, []);

    const total = useMemo(
        () => critical.length + routine.length,
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
