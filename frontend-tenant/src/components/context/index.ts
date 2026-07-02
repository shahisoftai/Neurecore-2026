/**
 * Context Components Index
 *
 * Central export point for context-related components and types.
 * SOLID: Dependency Inversion - Imports depend on this interface
 */

export { ContextCard as ContextCardComponent } from './ContextCard';
export { DependencyGraph as DependencyGraphComponent } from './DependencyGraph';
export { ContextThread as ContextThreadComponent } from './ContextThread';

// Also export as default for convenience
export { default as ContextCard } from './ContextCard';
export { default as DependencyGraph } from './DependencyGraph';
export { default as ContextThread } from './ContextThread';

export type {
    ContextCardProps,
    DependencyGraphProps,
    ContextThreadProps,
    ContextSectionState,
} from './types';
