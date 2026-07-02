/**
 * src/hooks/useAgents.ts
 *
 * React hook for agent data fetching with auto-refresh
 * SOLID:
 * - SRP: Only handles agent data fetching and state
 * - DIP: Depends on restClient service
 */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { restClient } from '@/core/services/api/clients/RestClient';
import type {
    Agent,
    OrchestrationSummary,
    AgentsQueryOptions,
    AgentsOrchestrationResponse,
} from '@/types/agents.types';

/**
 * Return type for useAgents hook
 * SOLID: ISP - Only needed fields
 */
export interface UseAgentsReturn {
    agents: Agent[];
    summary: OrchestrationSummary | null;
    isLoading: boolean;
    error: string | null;
    filter: 'all' | 'active' | 'idle' | 'offline';
    setFilter: (filter: 'all' | 'active' | 'idle' | 'offline') => void;
    refetch: () => Promise<void>;
}

/**
 * useAgents Hook
 * SOLID: SRP - Only handles agent data fetching
 *
 * Features:
 * - Auto-refresh with configurable interval
 * - Error handling and retry
 * - Filter support
 * - Memoized returns
 *
 * Usage:
 * const { agents, summary, isLoading } = useAgents({ autoRefresh: true });
 */
export const useAgents = (options?: {
    autoRefresh?: boolean;
    refreshInterval?: number;
}): UseAgentsReturn => {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [summary, setSummary] = useState<OrchestrationSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<
        'all' | 'active' | 'idle' | 'offline'
    >('all');

    const autoRefresh = options?.autoRefresh ?? true;
    const refreshInterval = options?.refreshInterval ?? 30000; // 30s default

    /**
     * Fetch agent orchestration data
     * SOLID: SRP - Only data fetching
     */
    const fetchAgents = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await restClient.get<AgentsOrchestrationResponse>(
                '/agents/orchestration'
            );

            // Extract data from API response wrapper
            const orchestrationData = response.data;

            if (orchestrationData) {
                setAgents(orchestrationData.agents);
                setSummary(orchestrationData.summary);
            } else {
                setError('Failed to fetch agents');
            }
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useAgents] Error:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Auto-refresh effect
     * SOLID: SRP - Only manages refresh interval
     */
    useEffect(() => {
        // Initial fetch
        fetchAgents();

        // Auto-refresh interval
        if (!autoRefresh) return;

        const interval = setInterval(fetchAgents, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchAgents, autoRefresh, refreshInterval]);

    /**
     * Memoized filtered agents
     * SOLID: SRP - Only filtering logic
     */
    const filteredAgents = useMemo(() => {
        switch (filter) {
            case 'active':
                return agents.filter(a => a.status === 'ACTIVE');
            case 'idle':
                return agents.filter(a => a.status === 'IDLE');
            case 'offline':
                return agents.filter(a => a.status === 'OFFLINE');
            default:
                return agents;
        }
    }, [agents, filter]);

    /**
     * Updated summary based on filter
     * SOLID: SRP - Only summary recalculation
     */
    const updatedSummary = useMemo(
        () => {
            if (!summary) return null;
            return {
                ...summary,
                totalOnline: agents.filter(
                    a => a.status !== 'OFFLINE'
                ).length,
                totalOffline: agents.filter(
                    a => a.status === 'OFFLINE'
                ).length,
            };
        },
        [agents, summary]
    );

    return {
        agents: filteredAgents,
        summary: updatedSummary,
        isLoading,
        error,
        filter,
        setFilter,
        refetch: fetchAgents,
    };
};
