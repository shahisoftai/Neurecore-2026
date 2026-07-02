/**
 * src/components/context/types.ts - Frontend context component types
 *
 * SOLID: ISP - Separate interfaces for different concerns
 */

/**
 * Props for ContextCard component
 * SOLID: SRP - Only card-related props
 */
export interface ContextCardProps {
    id: string;
    title: string;
    description?: string;
    status: 'ON_TRACK' | 'AT_RISK' | 'BLOCKED' | 'COMPLETED';
    progressScore: number; // 0-100
    departmentStats: Array<{
        dept: string;
        stat: string;
        value: string | number;
        icon?: string;
        color?: 'green' | 'blue' | 'yellow' | 'red' | 'purple';
    }>;
    onViewDetails?: () => void;
}

/**
 * Props for DependencyGraph component
 * SOLID: ISP - Only dependency-related props
 */
export interface DependencyGraphProps {
    upstreamBlockers: Array<{
        id: string;
        source: string;
        description: string;
        estimatedHours?: number;
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
    }>;
    downstreamWaiters: Array<{
        id: string;
        target: string;
        description: string;
        estimatedHours?: number;
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
    }>;
    onBlockerClick?: (id: string) => void;
}

/**
 * Props for ContextThread component
 * SOLID: SRP - Only thread display props
 */
export interface ContextThreadProps {
    initiativeId: string;
    title: string;
    description?: string;
    departmentCount: number;
    progressScore: number;
    lastUpdated?: Date | string;
}

/**
 * Context section state management
 * SOLID: SRP - State structure for context
 */
export interface ContextSectionState {
    initiatives: ContextCardProps[];
    blockers: DependencyGraphProps['upstreamBlockers'];
    waiters: DependencyGraphProps['downstreamWaiters'];
    isLoading: boolean;
    error?: string | null;
}
