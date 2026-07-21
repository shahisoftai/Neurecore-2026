'use client';

/**
 * Breadcrumb — Navigation context hierarchy (Phase 7)
 *
 * SOLID Principles:
 * - S: Single responsibility (display breadcrumb path)
 * - O: Extensible with custom separators, styling
 * - L: Composable items follow consistent interface
 * - I: Minimal props required; optional customization
 * - D: Components depend on BreadcrumbItem interface, not concrete rendering
 *
 * Displays hierarchical navigation path to current page.
 * Used on all detail pages: /agents/[id], /workflows/[id], etc.
 */

import { type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItemConfig {
    /** Display label */
    label: string;
    /** Optional href for clickable navigation */
    href?: string;
    /** Whether this is the current page (last item) */
    active?: boolean;
}

export interface BreadcrumbProps {
    /** Array of breadcrumb items */
    items: BreadcrumbItemConfig[];
    /** Custom separator component (default: ChevronRight) */
    separator?: ReactNode;
    /** CSS classes */
    className?: string;
}

/**
 * Breadcrumb — Display hierarchical navigation path
 *
 * @example
 * <Breadcrumb items={[
 *   { label: 'Employees', href: '/agents' },
 *   { label: 'Alex AI Agent', active: true }
 * ]} />
 *
 * Renders as: Agents > Alex AI Agent
 */
export function Breadcrumb({
    items,
    separator = <ChevronRight className="w-4 h-4" />,
    className,
}: BreadcrumbProps) {
    if (!items.length) return null;

    return (
        <nav
            className={cn('flex items-center gap-2 text-sm mb-6', className)}
            aria-label="Breadcrumb"
        >
            {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                    {/* Separator (not shown before first item) */}
                    {index > 0 && (
                        <span className="text-zinc-500 shrink-0">{separator}</span>
                    )}

                    {/* Breadcrumb item */}
                    {item.href && !item.active ? (
                        <Link
                            href={item.href}
                            className="text-accent-500 hover:text-accent-400 hover:underline transition truncate"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span
                            className={cn(
                                'truncate',
                                item.active
                                    ? 'text-zinc-100 font-medium'
                                    : 'text-zinc-400',
                            )}
                        >
                            {item.label}
                        </span>
                    )}
                </div>
            ))}
        </nav>
    );
}

/**
 * BreadcrumbCompact — Minimal breadcrumb for inline use
 * Shows only current item with back option
 */
export function BreadcrumbCompact({
    parent,
    current,
    onBack,
    className,
}: {
    parent?: { label: string; href?: string };
    current: string;
    onBack?: () => void;
    className?: string;
}) {
    return (
        <div className={cn('flex items-center gap-2 text-sm', className)}>
            {onBack && (
                <button
                    onClick={onBack}
                    className="text-accent-500 hover:text-accent-400 transition"
                    aria-label="Go back"
                >
                    ← Back
                </button>
            )}
            {parent && (
                <>
                    {parent.href ? (
                        <Link
                            href={parent.href}
                            className="text-accent-500 hover:text-accent-400 hover:underline transition"
                        >
                            {parent.label}
                        </Link>
                    ) : (
                        <span className="text-zinc-400">{parent.label}</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                </>
            )}
            <span className="text-zinc-100 font-medium truncate">{current}</span>
        </div>
    );
}

export default Breadcrumb;
