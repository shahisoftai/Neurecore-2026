'use client';

/**
 * useSearch — Server-side search + filtering hook (Phase 8)
 *
 * SOLID Principles:
 * - S: Single responsibility (manage search/filter state + server calls)
 * - O: Open/Closed - extensible with custom filters via config
 * - L: Liskov Substitution - drop-in for any search-enabled component
 * - I: Interface Segregation - minimal required props
 * - D: Dependency Inversion - depends on API abstraction (onSearch callback)
 *
 * Features:
 *   - Debounced search query
 *   - Multi-field filters (key-value)
 *   - Pagination state (page + limit)
 *   - Sort state (column + direction)
 *   - Loading/error states
 *   - Automatic refetch on filter change
 */

import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

export interface SearchFilter {
    [key: string]: string | number | boolean | undefined;
}

export interface SearchState {
    /** Search query string */
    query: string;
    /** Filter key-value pairs */
    filters: SearchFilter;
    /** Current page (1-indexed) */
    page: number;
    /** Items per page */
    limit: number;
    /** Sort column */
    sortBy?: string;
    /** Sort direction */
    sortDir?: 'asc' | 'desc';
}

export interface SearchResult<T> {
    /** Results for current page */
    data: T[];
    /** Total items count */
    total: number;
    /** Has more pages */
    hasMore: boolean;
}

export interface UseSearchConfig<T> {
    /** Search server endpoint or callback */
    onSearch: (state: SearchState) => Promise<SearchResult<T>>;
    /** Initial search query */
    initialQuery?: string;
    /** Initial filters */
    initialFilters?: SearchFilter;
    /** Initial page (1-indexed) */
    initialPage?: number;
    /** Items per page */
    limit?: number;
    /** Debounce delay (ms) */
    debounce?: number;
}

export interface UseSearchReturn<T> {
    // ─ Data state ─
    /** Search results */
    data: T[];
    /** Total items */
    total: number;
    /** Has next page */
    hasMore: boolean;
    /** Loading state */
    loading: boolean;
    /** Error message */
    error?: string;

    // ─ Search state ─
    /** Current query */
    query: string;
    /** Current filters */
    filters: SearchFilter;
    /** Current page */
    page: number;
    /** Items per page */
    limit: number;
    /** Sort column */
    sortBy?: string;
    /** Sort direction */
    sortDir?: 'asc' | 'desc';

    // ─ Setters ─
    /** Update search query (debounced) */
    setQuery: (query: string) => void;
    /** Update filters (debounced) */
    setFilters: Dispatch<SetStateAction<SearchFilter>>;
    /** Go to page */
    setPage: (page: number) => void;
    /** Change limit (resets to page 1) */
    setLimit: (limit: number) => void;
    /** Set sort */
    setSort: (column: string, dir?: 'asc' | 'desc') => void;
    /** Clear all filters */
    clearFilters: () => void;
    /** Clear everything */
    reset: () => void;
}

/**
 * useSearch — Server-side search with debouncing + filtering + pagination
 *
 * @example
 * const search = useSearch({
 *   onSearch: async (state) => {
 *     const res = await fetch(`/api/agents?q=${state.query}&page=${state.page}`);
 *     return res.json();
 *   },
 *   initialQuery: '',
 *   limit: 20
 * });
 *
 * return (
 *   <>
 *     <input
 *       value={search.query}
 *       onChange={(e) => search.setQuery(e.target.value)}
 *       placeholder="Search..."
 *     />
 *     {search.loading && <Skeleton />}
 *     {search.error && <Error msg={search.error} />}
 *     {!search.loading && <Table data={search.data} />}
 *   </>
 * );
 */
export function useSearch<T>({
    onSearch,
    initialQuery = '',
    initialFilters = {},
    initialPage = 1,
    limit = 20,
    debounce: debounceMs = 300,
}: UseSearchConfig<T>): UseSearchReturn<T> {
    // ─── State ────────────────────────────────────────────────────────────
    const [data, setData] = useState<T[]>([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    const [query, setQueryRaw] = useState(initialQuery);
    const [filters, setFiltersRaw] = useState(initialFilters);
    const [page, setPageRaw] = useState(initialPage);
    const [pageLimit, setPageLimit] = useState(limit);
    const [sortBy, setSortByRaw] = useState<string>();
    const [sortDir, setSortDirRaw] = useState<'asc' | 'desc'>('asc');

    const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // ─── Fetch data ────────────────────────────────────────────────────────
    const fetchSearch = useCallback(
        async (state: SearchState) => {
            try {
                setLoading(true);
                setError(undefined);
                const result = await onSearch(state);
                setData(result.data);
                setTotal(result.total);
                setHasMore(result.hasMore);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Search failed');
                setData([]);
            } finally {
                setLoading(false);
            }
        },
        [onSearch],
    );

    // ─── Auto-fetch on state change ────────────────────────────────────────
    useEffect(() => {
        const state: SearchState = {
            query,
            filters,
            page,
            limit: pageLimit,
            sortBy,
            sortDir,
        };

        // Clear debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Set new timer (debounce for query changes, immediate for others)
        const timer = setTimeout(() => {
            fetchSearch(state);
        }, debounceMs);

        debounceTimerRef.current = timer;

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [query, filters, page, pageLimit, sortBy, sortDir, fetchSearch, debounceMs]);

    // ─── Setters (with logic) ──────────────────────────────────────────────
    const setQuery = useCallback((newQuery: string) => {
        setQueryRaw(newQuery);
        setPageRaw(1); // Reset to page 1 on new search
    }, []);

    const setFilters = useCallback((updater: SearchFilter | ((prev: SearchFilter) => SearchFilter)) => {
        setFiltersRaw(updater);
        setPageRaw(1); // Reset to page 1 on filter change
    }, []);

    const setPage = useCallback((newPage: number) => {
        setPageRaw(newPage);
    }, []);

    const setLimit = useCallback((newLimit: number) => {
        setPageLimit(newLimit);
        setPageRaw(1); // Reset to page 1 on limit change
    }, []);

    const setSort = useCallback((column: string, dir: 'asc' | 'desc' = 'asc') => {
        setSortByRaw(column);
        setSortDirRaw(dir);
    }, []);

    const clearFilters = useCallback(() => {
        setFiltersRaw({});
        setPageRaw(1);
    }, []);

    const reset = useCallback(() => {
        setQueryRaw(initialQuery);
        setFiltersRaw(initialFilters);
        setPageRaw(initialPage);
        setPageLimit(limit);
        setSortByRaw(undefined);
        setSortDirRaw('asc');
        setData([]);
    }, [initialQuery, initialFilters, initialPage, limit]);

    return {
        // ─ Data
        data,
        total,
        hasMore,
        loading,
        error,

        // ─ State
        query,
        filters,
        page,
        limit: pageLimit,
        sortBy,
        sortDir,

        // ─ Setters
        setQuery,
        setFilters,
        setPage,
        setLimit,
        setSort,
        clearFilters,
        reset,
    };
}

export default useSearch;
