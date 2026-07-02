/**
 * timeline.types.ts - Shared timeline interfaces
 *
 * Used by both frontend and backend for timeline events.
 * SOLID: Single Responsibility - Type definitions only
 */

export type TimelineEventType =
    | 'APPROVAL_NEEDED'
    | 'ACTION_TAKEN'
    | 'OPPORTUNITY'
    | 'FYI'
    | 'BLOCKER'
    | 'MILESTONE'
    | 'ALERT';

export type TimelineEventImpact = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type TimelineFilterType = 'all' | 'urgent' | 'my-action' | 'opportunities' | 'blockers';

/**
 * Represents a single timeline event
 */
export interface TimelineEvent {
    id: string;
    type: TimelineEventType;
    title: string;
    description?: string;
    impact: TimelineEventImpact;
    timestamp: Date | string;
    icon?: string;
    actions?: TimelineEventAction[];
    metadata?: TimelineEventMetadata;
    read?: boolean;
}

/**
 * Clickable action within an event
 */
export interface TimelineEventAction {
    label: string;
    action: 'navigate' | 'dismiss' | 'custom';
    target?: string;
    isPrimary?: boolean;
}

/**
 * Event-specific context data
 */
export interface TimelineEventMetadata {
    agent?: {
        id: string;
        name: string;
    };
    department?: {
        id: string;
        name: string;
    };
    amount?: number;
    metric?: string;
    priority?: number;
    [key: string]: unknown;
}

/**
 * Timeline page state
 */
export interface TimelineState {
    filter: TimelineFilterType;
    sortBy: 'impact' | 'recent' | 'priority';
    searchTerm?: string;
}

/**
 * Timeline events response from backend
 */
export interface TimelineResponse {
    events: TimelineEvent[];
    summary: {
        urgentCount: number;
        myActionCount: number;
        totalToday: number;
        unreadCount?: number;
    };
    pagination?: {
        page: number;
        limit: number;
        total: number;
    };
}
