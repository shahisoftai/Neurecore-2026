/**
 * context.types.ts - Shared context/initiative interfaces
 *
 * Used by both frontend and backend for cross-department context.
 * SOLID: Single Responsibility - Type definitions only
 */

/**
 * Status of a cross-functional initiative
 */
export type InitiativeStatus = 'ON_TRACK' | 'AT_RISK' | 'BLOCKED' | 'COMPLETED';

/**
 * Department-specific stat within an initiative
 */
export interface DepartmentStat {
    /** Department ID or name */
    dept: string;
    /** Stat label (e.g., "Qualified leads", "Posts queued") */
    stat: string;
    /** Stat value (string or number) */
    value: string | number;
    /** Optional Lucide icon name */
    icon?: string;
    /** Optional color for visual distinction */
    color?: 'green' | 'blue' | 'yellow' | 'red' | 'purple';
}

/**
 * Cross-functional initiative (e.g., "Atlas v2 Launch")
 * SOLID: ISP - Only initiative-related fields
 */
export interface Initiative {
    id: string;
    title: string;
    description?: string;
    status: InitiativeStatus;
    /** Progress 0-100 */
    progressScore: number;
    /** Department stats across this initiative */
    departmentStats: DepartmentStat[];
    /** Creation timestamp */
    createdAt: Date | string;
    /** Last update */
    updatedAt?: Date | string;
}

/**
 * Dependency relationship (blocker or waiter)
 * SOLID: ISP - Only dependency-related fields
 */
export interface Dependency {
    id: string;
    /** Source department/team */
    source: string;
    /** Target department/team */
    target: string;
    /** Description of blocker/dependency */
    description: string;
    /** Type of dependency */
    type: 'blocker' | 'waiter' | 'related';
    /** Estimated resolution time in hours */
    estimatedHours?: number;
    /** Priority level */
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Context page response for a department
 * SOLID: SRP - Single response type for context endpoint
 */
export interface ContextResponse {
    /** Initiatives this department is involved in */
    initiatives: Initiative[];
    /** Upstream/downstream dependencies */
    dependencies: {
        upstreamBlockers: Dependency[];
        downstreamWaiters: Dependency[];
        related: Dependency[];
    };
    /** Summary stats */
    summary: {
        activeInitiatives: number;
        blockedCount: number;
        dependenciesCount: number;
    };
}

/**
 * Query options for context fetching
 * SOLID: ISP - Only context query fields
 */
export interface ContextQueryOptions {
    departmentId: string;
    includeHistory?: boolean;
    includeRelated?: boolean;
    limit?: number;
}
