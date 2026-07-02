/**
 * Timeline Components Index
 *
 * Central export point for timeline-related components and types.
 * SOLID: Dependency Inversion - Imports depend on this interface
 */

export { TimelineEvent as TimelineEventComponent } from './TimelineEvent';
export { ImpactTimeline } from './ImpactTimeline';
export { TimelineFilter } from './TimelineFilter';

// Also export the component as default for convenience
export { default as TimelineEvent } from './TimelineEvent';

export type {
    TimelineEvent as TimelineEventData,
    TimelineEventType,
    TimelineEventImpact,
    TimelineEventAction,
    TimelineEventMetadata,
    TimelineFilterType,
    TimelineState,
    TimelineResponse,
} from './types';
