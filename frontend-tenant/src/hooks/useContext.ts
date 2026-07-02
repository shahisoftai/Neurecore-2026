/**
 * src/hooks/useContext.ts
 *
 * React hook for context/initiative data fetching and state management
 * SOLID:
 * - SRP: Only handles data fetching and state
 * - OCP: Extensible via options parameter
 * - DIP: Depends on restClient abstraction
 */

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { restClient } from '@/core/services/api/clients/RestClient';
import type { ContextResponse } from '@/types/context.types';
import type { ApiResponse } from '@/types/api.types';

/**
 * Hook options for context fetching
 * SOLID: ISP - Only includes needed options
 */
interface UseContextOptions {
    departmentId: string;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

/**
 * Return type for useContext hook
 * SOLID: ISP - Only exposes needed state
 */
interface UseContextReturn {
    initiatives: ReturnType<typeof useMemo>;
    blockers: ReturnType<typeof useMemo>;
    waiters: ReturnType<typeof useMemo>;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * useContext Hook
 * Manages context/initiative data fetching with auto-refresh
 *
 * SOLID:
 * - SRP: Only handles context data
 * - OCP: Extensible via options
 * - DIP: Depends on restClient
 *
 * @param options - Hook configuration
 * @returns Context data and control functions
 */
export const useContext = (options: UseContextOptions): UseContextReturn => {
    const { departmentId, autoRefresh = false, refreshInterval = 30000 } = options;

    // State management
    const [contextData, setContextData] = useState<ContextResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    /**
     * Fetch context data from backend
     * SOLID: Pure side-effect function (depends on restClient)
     */
    const fetchContext = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await restClient.get<ContextResponse>(
                `/departments/${departmentId}/context`
            );

            // Extract data from API response wrapper
            const contextData = response.data;

            if (contextData) {
                setContextData(contextData);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch context');
            setError(error);
            console.error('[useContext] Error fetching context:', error);
        } finally {
            setIsLoading(false);
        }
    }, [departmentId]);

    /**
     * Initial fetch on mount
     */
    useEffect(() => {
        fetchContext();
    }, [fetchContext]);

    /**
     * Auto-refresh effect
     */
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchContext();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchContext]);

    /**
     * Memoized initiatives for performance
     * SOLID: Pure computation (no side effects)
     */
    const initiatives = useMemo(
        () =>
            contextData?.initiatives.map((init) => ({
                id: init.id,
                title: init.title,
                description: init.description,
                status: init.status,
                progressScore: init.progressScore,
                departmentStats: init.departmentStats,
            })) || [],
        [contextData]
    );

    /**
     * Memoized blockers for performance
     * SOLID: Pure computation (no side effects)
     */
    const blockers = useMemo(
        () =>
            contextData?.dependencies.upstreamBlockers.map((blocker) => ({
                id: blocker.id,
                source: blocker.source,
                description: blocker.description,
                estimatedHours: blocker.estimatedHours,
                priority: blocker.priority,
            })) || [],
        [contextData]
    );

    /**
     * Memoized waiters for performance
     * SOLID: Pure computation (no side effects)
     */
    const waiters = useMemo(
        () =>
            contextData?.dependencies.downstreamWaiters.map((waiter) => ({
                id: waiter.id,
                target: waiter.target,
                description: waiter.description,
                estimatedHours: waiter.estimatedHours,
                priority: waiter.priority,
            })) || [],
        [contextData]
    );

    return {
        initiatives,
        blockers,
        waiters,
        isLoading,
        error,
        refetch: fetchContext,
    };
};
