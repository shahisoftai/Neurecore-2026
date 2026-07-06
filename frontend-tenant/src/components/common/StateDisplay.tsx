'use client';

/**
 * StateDisplay — Empty and error state components (Phase 7)
 *
 * SOLID Principles:
 * - S: EmptyState for no data, ErrorState for failures
 * - O: Extensible with custom icons, titles, actions
 * - L: Both follow same rendering contract
 * - I: Minimal required props (icon, title); optional action
 * - D: Components depend on action prop abstraction, not concrete handlers
 *
 * Provides consistent UI for:
 *   - Empty states (no results, no data)
 *   - Error states (load failures, permission denied)
 *   - Retry patterns with action buttons
 */

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Button from './Button';

export interface StateDisplayProps {
    /** Icon to display (lucide-react component) */
    icon: ReactNode;
    /** Main title/heading */
    title: string;
    /** Optional description/subtitle */
    description?: string;
    /** Optional action button configuration */
    action?: {
        label: string;
        onClick: () => void | Promise<void>;
    };
    /** Additional CSS classes */
    className?: string;
}

/**
 * EmptyState — Display when no data available
 *
 * @example
 * <EmptyState
 *   icon={<SearchIcon />}
 *   title="No agents found"
 *   description="Try adjusting your filters"
 *   action={{ label: 'Create agent', onClick: () => router.push('/agents/new') }}
 * />
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: StateDisplayProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-12 px-4 text-center',
                className,
            )}
        >
            {/* Icon with subtle background */}
            <div className="mb-4 p-3 rounded-xl bg-surface-overlay/50 text-zinc-400">
                <div className="w-8 h-8">{icon}</div>
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-zinc-100 mb-1">{title}</h3>

            {/* Description */}
            {description && (
                <p className="text-sm text-zinc-500 mb-4 max-w-sm">{description}</p>
            )}

            {/* Action button */}
            {action && (
                <Button
                    variant="primary"
                    size="sm"
                    onClick={action.onClick}
                >
                    {action.label}
                </Button>
            )}
        </div>
    );
}

/**
 * ErrorState — Display when data load fails
 *
 * @example
 * <ErrorState
 *   icon={<AlertTriangleIcon />}
 *   title="Failed to load tasks"
 *   description="Please try again or contact support"
 *   action={{ label: 'Retry', onClick: refetch }}
 * />
 */
export function ErrorState({
    icon,
    title,
    description,
    action,
    className,
}: StateDisplayProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-12 px-4 text-center border border-state-danger/30 rounded-lg bg-state-danger/5',
                className,
            )}
        >
            {/* Icon with error background */}
            <div className="mb-4 p-3 rounded-xl bg-state-danger/10 text-state-danger">
                <div className="w-8 h-8">{icon}</div>
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-state-danger mb-1">{title}</h3>

            {/* Description */}
            {description && (
                <p className="text-sm text-zinc-500 mb-4 max-w-sm">{description}</p>
            )}

            {/* Action button (retry) */}
            {action && (
                <Button
                    variant="danger"
                    size="sm"
                    onClick={action.onClick}
                >
                    {action.label}
                </Button>
            )}
        </div>
    );
}

/**
 * NoPermissionState — Specialized error state for permission denied
 *
 * @example
 * <NoPermissionState
 *   resource="This page"
 *   action={{ label: 'Request access', onClick: () => ... }}
 * />
 */
export function NoPermissionState({
    resource = 'This resource',
    action,
    className,
}: {
    resource?: string;
    action?: StateDisplayProps['action'];
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-12 px-4 text-center border border-state-warning/30 rounded-lg bg-state-warning/5',
                className,
            )}
        >
            {/* Icon */}
            <div className="mb-4 p-3 rounded-xl bg-state-warning/10 text-state-warning">
                <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                </svg>
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-state-warning mb-1">
                Access Denied
            </h3>

            {/* Description */}
            <p className="text-sm text-zinc-500 mb-4 max-w-sm">
                {resource} is restricted. Contact an administrator if you need access.
            </p>

            {/* Action button */}
            {action && (
                <Button
                    variant="warning"
                    size="sm"
                    onClick={action.onClick}
                >
                    {action.label}
                </Button>
            )}
        </div>
    );
}

export default EmptyState;
