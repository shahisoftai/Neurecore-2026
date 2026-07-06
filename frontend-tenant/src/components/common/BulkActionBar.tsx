'use client';

/**
 * BulkActionBar — Action bar for bulk operations (Phase 8)
 *
 * SOLID Principles:
 * - S: Single responsibility (display bulk actions + selection count)
 * - O: Open/Closed - extensible via actions prop
 * - L: Liskov Substitution - works standalone or with UnifiedDataTable
 * - I: Interface Segregation - minimal required props
 * - D: Dependency Inversion - depends on action callback abstraction
 *
 * Features:
 *   - Selection count display
 *   - Multiple action buttons
 *   - Loading/disabled states
 *   - Dismiss button
 *   - Animated appearance/disappearance
 */

import { useState, type ReactNode } from 'react';
import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface BulkActionItem {
    /** Action identifier */
    id: string;
    /** Display label */
    label: string;
    /** Visual variant */
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
    /** Action handler */
    onClick: () => void | Promise<void>;
    /** Disable action */
    disabled?: boolean;
    /** Loading state */
    loading?: boolean;
    /** Custom icon component */
    icon?: ReactNode;
}

export interface BulkActionBarProps {
    /** Selection count (hide bar if 0) */
    count: number;
    /** Action items */
    actions: BulkActionItem[];
    /** On dismiss bar */
    onDismiss?: () => void;
    /** Selected item label (e.g., "agents", "tasks") */
    itemLabel?: string;
    /** Bar CSS class */
    className?: string;
}

/**
 * BulkActionBar — Floating bar for bulk operations
 *
 * @example
 * <BulkActionBar
 *   count={selectedIds.length}
 *   itemLabel="agents"
 *   actions={[
 *     {
 *       id: 'delete',
 *       label: 'Delete',
 *       variant: 'danger',
 *       onClick: () => deleteMany(selectedIds),
 *       icon: <Trash2 />
 *     },
 *     {
 *       id: 'archive',
 *       label: 'Archive',
 *       variant: 'secondary',
 *       onClick: () => archiveMany(selectedIds)
 *     }
 *   ]}
 *   onDismiss={() => setSelectedIds([])}
 * />
 */
export function BulkActionBar({
    count,
    actions,
    onDismiss,
    itemLabel = 'items',
    className = '',
}: BulkActionBarProps) {
    const [loadingActionId, setLoadingActionId] = useState<string>();

    const handleActionClick = async (action: BulkActionItem) => {
        try {
            setLoadingActionId(action.id);
            await action.onClick();
        } finally {
            setLoadingActionId(undefined);
        }
    };

    return (
        <AnimatePresence>
            {count > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-2xl',
                        className,
                    )}
                >
                    <div className="px-4 py-3 rounded-lg bg-accent-500/10 border border-accent-500/30 backdrop-blur-xl flex items-center justify-between gap-4 shadow-lg">
                        {/* Selection count */}
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-zinc-200 whitespace-nowrap">
                                {count} {itemLabel} selected
                            </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 items-center">
                            {actions.map((action) => (
                                <Button
                                    key={action.id}
                                    size="sm"
                                    variant={action.variant ?? 'secondary'}
                                    disabled={action.disabled || loadingActionId !== undefined}
                                    loading={loadingActionId === action.id}
                                    onClick={() => handleActionClick(action)}
                                    icon={action.icon && !action.loading ? action.icon : undefined}
                                >
                                    {action.label}
                                </Button>
                            ))}

                            {/* Dismiss button */}
                            {onDismiss && (
                                <button
                                    onClick={onDismiss}
                                    className="p-1 rounded hover:bg-white/10 transition text-zinc-400 hover:text-zinc-200"
                                    aria-label="Dismiss"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default BulkActionBar;
