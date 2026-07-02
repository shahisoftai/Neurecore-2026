/**
 * src/components/agents/index.ts
 *
 * Central export point for agent components
 * SOLID: DIP - Dependency inversion through exports
 */

// Export components with aliasing for conflict avoidance
export { AgentCardComponent } from './AgentCard';
export {
    AgentOrchestrationBoardComponent,
} from './AgentOrchestrationBoard';
export {
    AgentStatusWidgetComponent,
} from './AgentStatusWidget';

// Re-export types from component files (no local re-exports)
export type {
    AgentCardProps,
    AgentOrchestrationBoardProps,
    AgentStatusWidgetProps,
    AgentDetailProps,
} from './types';

// Default exports for convenience
export { AgentCardComponent as AgentCard } from './AgentCard';
export {
    AgentOrchestrationBoardComponent as AgentOrchestrationBoard,
} from './AgentOrchestrationBoard';
export {
    AgentStatusWidgetComponent as AgentStatusWidget,
} from './AgentStatusWidget';

