/**
 * Timeline Types - Shared interfaces for timeline components
 *
 * SOLID: Interface Segregation - Each interface has a single purpose
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
 * SOLID: Single Responsibility - Describes event data only
 */
export interface TimelineEvent {
    id: string;
    type: TimelineEventType;
    title: string;
    description?: string;
    impact: TimelineEventImpact;
    timestamp: Date | string;
    icon?: string; // Emoji or icon identifier
    actions?: TimelineEventAction[];
    metadata?: TimelineEventMetadata;
    read?: boolean;
}

/**
 * Clickable action within an event
 * SOLID: Interface Segregation - Only action properties
 */
export interface TimelineEventAction {
    label: string;
    action: 'navigate' | 'dismiss' | 'custom';
    target?: string; // URL or action identifier
    isPrimary?: boolean;
}

/**
 * Event-specific context data
 * SOLID: Interface Segregation - Only metadata properties
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
 * SOLID: Single Responsibility - Only filter/sort state
 */
export interface TimelineState {
    filter: TimelineFilterType;
    sortBy: 'impact' | 'recent' | 'priority';
    searchTerm: string;
}

/**
 * Timeline events response from backend
 * SOLID: Interface Segregation - Only API response structure
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
