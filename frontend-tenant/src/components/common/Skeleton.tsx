'use client';

/**
 * Skeleton — Loading state components (Phase 7)
 *
 * SOLID Principles:
 * - S: Each skeleton matches its content shape
 * - O: Extensible with new skeleton variants
 * - L: All skeletons use same shimmer animation
 * - I: Minimal props required
 * - D: Depends on animation abstraction, not concrete timing
 *
 * Provides reusable skeleton (placeholder) components for:
 *   - Cards (KPI, content, profile)
 *   - Tables (row sets)
 *   - Text/paragraphs
 *   - Charts
 *   - Buttons
 */

import { cn } from '@/lib/utils';

export interface SkeletonProps {
    /** CSS class for custom sizing */
    className?: string;
}

// ─── Base skeleton shape ────────────────────────────────────────────────────
const SKELETON_BASE =
    'animate-pulse bg-gradient-to-r from-surface-raised via-surface-overlay to-surface-raised bg-[length:200%_100%] bg-left-bottom';

/**
 * SkeletonCard — Placeholder for content cards
 * Mimics: KpiCard, EntityCard, ProfileCard
 */
export function SkeletonCard({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                'rounded-lg border border-surface-border p-4 space-y-3',
                className,
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className={cn(SKELETON_BASE, 'h-5 w-24 rounded')} />
                <div className={cn(SKELETON_BASE, 'h-4 w-12 rounded')} />
            </div>

            {/* Content */}
            <div className="space-y-2">
                <div className={cn(SKELETON_BASE, 'h-6 w-full rounded')} />
                <div className={cn(SKELETON_BASE, 'h-4 w-3/4 rounded')} />
            </div>

            {/* Footer */}
            <div className="flex gap-2 pt-2">
                <div className={cn(SKELETON_BASE, 'h-4 w-16 rounded')} />
                <div className={cn(SKELETON_BASE, 'h-4 w-20 rounded')} />
            </div>
        </div>
    );
}

/**
 * SkeletonTable — Placeholder for table rows
 * Pass `rows` to control number of rows to render
 */
export function SkeletonTable({ rows = 5, className }: SkeletonProps & { rows?: number }) {
    return (
        <div className={cn('space-y-2', className)}>
            {/* Header row */}
            <div className="flex gap-4 px-4 py-2 border-b border-surface-border">
                <div className={cn(SKELETON_BASE, 'h-4 w-8 rounded')} />
                <div className={cn(SKELETON_BASE, 'h-4 w-32 rounded')} />
                <div className={cn(SKELETON_BASE, 'h-4 w-24 rounded')} />
                <div className={cn(SKELETON_BASE, 'h-4 w-20 rounded')} />
                <div className={cn(SKELETON_BASE, 'h-4 flex-1 rounded')} />
            </div>

            {/* Data rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 px-4 py-2 border-b border-surface-border/50">
                    <div className={cn(SKELETON_BASE, 'h-4 w-8 rounded')} />
                    <div className={cn(SKELETON_BASE, 'h-4 w-32 rounded')} />
                    <div className={cn(SKELETON_BASE, 'h-4 w-24 rounded')} />
                    <div className={cn(SKELETON_BASE, 'h-4 w-20 rounded')} />
                    <div className={cn(SKELETON_BASE, 'h-4 flex-1 rounded')} />
                </div>
            ))}
        </div>
    );
}

/**
 * SkeletonText — Placeholder for text blocks
 * Creates multiple lines of varying widths for natural appearance
 */
export function SkeletonText({
    lines = 3,
    className,
}: SkeletonProps & { lines?: number }) {
    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        SKELETON_BASE,
                        'h-4 rounded',
                        i === lines - 1 ? 'w-3/4' : 'w-full',
                    )}
                />
            ))}
        </div>
    );
}

/**
 * SkeletonChart — Placeholder for chart/graph components
 * Provides 3D appearance with multiple stacked bars
 */
export function SkeletonChart({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                'rounded-lg border border-surface-border p-4 space-y-4',
                className,
            )}
        >
            {/* Chart title */}
            <div className={cn(SKELETON_BASE, 'h-4 w-32 rounded')} />

            {/* Chart area */}
            <div className="h-48 flex items-end gap-2 px-2 py-4">
                {[80, 60, 90, 50, 75, 85, 70].map((height, i) => (
                    <div
                        key={i}
                        className="flex-1 rounded-t-lg bg-gradient-to-b from-surface-overlay via-surface-overlay to-surface-raised animate-pulse"
                        style={{ height: `${height}%` }}
                    />
                ))}
            </div>

            {/* Legend */}
            <div className="flex gap-4 pt-2">
                <div className={cn(SKELETON_BASE, 'h-3 w-24 rounded')} />
                <div className={cn(SKELETON_BASE, 'h-3 w-32 rounded')} />
            </div>
        </div>
    );
}

/**
 * SkeletonButton — Placeholder for buttons
 */
export function SkeletonButton({ className }: SkeletonProps) {
    return <div className={cn(SKELETON_BASE, 'h-9 w-24 rounded-lg', className)} />;
}

/**
 * SkeletonAvatar — Placeholder for avatar images
 */
export function SkeletonAvatar({
    size = 'md',
    className,
}: SkeletonProps & { size?: 'sm' | 'md' | 'lg' }) {
    const sizeClass = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
    }[size];

    return (
        <div className={cn(SKELETON_BASE, 'rounded-full', sizeClass, className)} />
    );
}

export default SkeletonCard;
