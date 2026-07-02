/**
 * useTimeline.ts - Hook for fetching and managing timeline data
 *
 * SOLID Principles:
 * - Single Responsibility: Data fetching only
 * - Open/Closed: Extensible via configuration
 * - Liskov Substitution: Can be replaced with another data source
 * - Interface Segregation: Only timeline-related data
 * - Dependency Inversion: Depends on interfaces, not implementations
 */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { restClient } from '@/core/services/api/clients/RestClient';
import type {
    TimelineEvent,
    TimelineFilterType,
    TimelineResponse,
    TimelineState,
} from '@/components/timeline/types';

// ─── Types ────────────────────────────────────────────────────────────────

interface UseTimelineOptions {
    initialFilter?: TimelineFilterType;
    initialSort?: 'impact' | 'recent' | 'priority';
    autoRefresh?: boolean;
    refreshInterval?: number; // milliseconds
}

interface UseTimelineReturn {
    events: TimelineEvent[];
    isLoading: boolean;
    error: Error | null;
    filter: TimelineFilterType;
    setFilter: (filter: TimelineFilterType) => void;
    sortBy: 'impact' | 'recent' | 'priority';
    setSortBy: (sort: 'impact' | 'recent' | 'priority') => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    refetch: () => Promise<void>;
    eventCounts: Record<TimelineFilterType, number>;
    summary: TimelineResponse['summary'] | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────

/**
 * useTimeline - Manage timeline data and state
 *
 * Features:
 * - Fetches events from /command-center/timeline endpoint
 * - Manages filter, sort, and search state
 * - Auto-refresh capability
 * - Error handling
 * - Event counting by filter
 *
 * Usage:
 * ```typescript
 * const {
 *   events,
 *   isLoading,
 *   filter,
 *   setFilter,
 *   refetch,
 *   eventCounts
 * } = useTimeline({ initialFilter: 'urgent' });
 * ```
 */
export function useTimeline(options: UseTimelineOptions = {}): UseTimelineReturn {
    const {
        initialFilter = 'urgent',
        initialSort = 'impact',
        autoRefresh = false,
        refreshInterval = 30000, // 30 seconds
    } = options;

    // ── State ──────────────────────────────────────────────────────────────
    const [state, setState] = useState<TimelineState>({
        filter: initialFilter,
        sortBy: initialSort,
        searchTerm: '',
    });

    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [summary, setSummary] = useState<TimelineResponse['summary'] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // ── Fetch function ────────────────────────────────────────────────────
    const fetchTimeline = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Build query parameters
            const params = new URLSearchParams();
            params.append('sort', state.sortBy);
            params.append('filter', state.filter);
            if (state.searchTerm) {
                params.append('search', state.searchTerm);
            }

            // Fetch from backend - returns ApiResponse<TimelineResponse>
            const response = await restClient.get<TimelineResponse>(
                `/command-center/timeline?${params.toString()}`,
            );

            // Extract data from API response wrapper
            const timelineData = response.data;

            if (timelineData) {
                setEvents(timelineData.events || []);
                setSummary(timelineData.summary || null);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch timeline');
            setError(error);
            console.error('[useTimeline] Error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [state.sortBy, state.filter, state.searchTerm]);

    // ── Effects ────────────────────────────────────────────────────────────

    // Initial fetch and filter/sort changes
    useEffect(() => {
        void fetchTimeline();
    }, [fetchTimeline]);

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            void fetchTimeline();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchTimeline]);

    // ── Computed data ──────────────────────────────────────────────────────

    /**
     * Count events by filter type
     * SOLID: Single Responsibility - Counting logic
     */
    const eventCounts = useMemo<Record<TimelineFilterType, number>>(() => {
        const counts: Record<TimelineFilterType, number> = {
            all: events.length,
            urgent: 0,
            'my-action': 0,
            opportunities: 0,
            blockers: 0,
        };

        events.forEach((event) => {
            if (event.impact === 'CRITICAL' || event.impact === 'HIGH') {
                counts.urgent++;
            }
            if (event.type === 'APPROVAL_NEEDED' || event.type === 'ACTION_TAKEN') {
                counts['my-action']++;
            }
            if (event.type === 'OPPORTUNITY') {
                counts.opportunities++;
            }
            if (event.type === 'BLOCKER') {
                counts.blockers++;
            }
        });

        return counts;
    }, [events]);

    // ── State setters ──────────────────────────────────────────────────────

    const setFilter = useCallback((filter: TimelineFilterType) => {
        setState((prev) => ({ ...prev, filter }));
    }, []);

    const setSortBy = useCallback((sort: 'impact' | 'recent' | 'priority') => {
        setState((prev) => ({ ...prev, sortBy: sort }));
    }, []);

    const setSearchTerm = useCallback((term: string) => {
        setState((prev) => ({ ...prev, searchTerm: term || '' }));
    }, []);

    const refetch = useCallback(async () => {
        await fetchTimeline();
    }, [fetchTimeline]);

    // ── Return ────────────────────────────────────────────────────────────

    return {
        events,
        isLoading,
        error,
        filter: state.filter,
        setFilter,
        sortBy: state.sortBy,
        setSortBy,
        searchTerm: state.searchTerm,
        setSearchTerm,
        refetch,
        eventCounts,
        summary,
    };
}

export default useTimeline;
