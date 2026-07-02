/**
 * src/types/context.types.ts - Frontend context types
 *
 * Shared with backend for type safety
 * SOLID: ISP - Separate types for different concerns
 */

/**
 * Status of a cross-functional initiative
 */
export type InitiativeStatus = 'ON_TRACK' | 'AT_RISK' | 'BLOCKED' | 'COMPLETED';

/**
 * Department-specific stat within an initiative
 */
export interface DepartmentStat {
    dept: string;
    stat: string;
    value: string | number;
    icon?: string;
    color?: 'green' | 'blue' | 'yellow' | 'red' | 'purple';
}

/**
 * Cross-functional initiative
 * SOLID: ISP - Only initiative-related fields
 */
export interface Initiative {
    id: string;
    title: string;
    description?: string;
    status: InitiativeStatus;
    progressScore: number;
    departmentStats: DepartmentStat[];
    createdAt: Date | string;
    updatedAt?: Date | string;
}

/**
 * Dependency relationship
 * SOLID: ISP - Only dependency-related fields
 */
export interface Dependency {
    id: string;
    source: string;
    target: string;
    description: string;
    type: 'blocker' | 'waiter' | 'related';
    estimatedHours?: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Context page response
 * SOLID: SRP - Single response type
 */
export interface ContextResponse {
    initiatives: Initiative[];
    dependencies: {
        upstreamBlockers: Dependency[];
        downstreamWaiters: Dependency[];
        related: Dependency[];
    };
    summary: {
        activeInitiatives: number;
        blockedCount: number;
        dependenciesCount: number;
    };
}

/**
 * Query options for context
 * SOLID: ISP - Only context query fields
 */
export interface ContextQueryOptions {
    departmentId: string;
    includeHistory?: boolean;
    includeRelated?: boolean;
    limit?: number;
}
