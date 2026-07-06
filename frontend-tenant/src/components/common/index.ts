/**
 * Common components barrel export (Phase 7)
 *
 * SOLID: Single export point for all foundational components
 * Maintains clean import paths: import { Button, Skeleton, Breadcrumb } from '@/components/common'
 */

// Core interactive components
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';

// Loading/empty/error states
export {
    SkeletonCard,
    SkeletonTable,
    SkeletonText,
    SkeletonChart,
    SkeletonButton,
    SkeletonAvatar,
    type SkeletonProps,
} from './Skeleton';

// Display states
export {
    EmptyState,
    ErrorState,
    NoPermissionState,
    type StateDisplayProps,
} from './StateDisplay';

// Navigation
export {
    Breadcrumb,
    BreadcrumbCompact,
    type BreadcrumbProps,
    type BreadcrumbItemConfig,
} from './Breadcrumb';

// Phase 8: Data display & filtering
export {
    FilterPanel,
    type FilterField,
    type FilterPanelProps,
} from './FilterPanel';

export {
    BulkActionBar,
    type BulkActionItem,
    type BulkActionBarProps,
} from './BulkActionBar';
