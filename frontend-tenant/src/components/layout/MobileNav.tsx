'use client';

/**
 * MobileNav — Mobile navigation drawer (Phase 7)
 *
 * SOLID Principles:
 * - S: Single responsibility (mobile nav drawer)
 * - O: Extensible with custom nav items
 * - L: Composable with standard drawer pattern
 * - I: Minimal props required
 * - D: Depends on nav structure abstraction
 *
 * Provides collapsible navigation menu for mobile devices (<md breakpoint).
 * Triggered by hamburger button in mobile TopBar.
 */

import { ReactNode } from 'react';
import { X, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MobileNavProps {
    /** Mobile nav is open */
    open: boolean;
    /** Called when drawer should close */
    onClose: () => void;
    /** Navigation menu content */
    children: ReactNode;
}

/**
 * MobileNav — Slide-out navigation drawer for mobile
 */
export function MobileNav({ open, onClose, children }: MobileNavProps) {
    return (
        <>
            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Drawer */}
            <nav
                className={cn(
                    'fixed top-0 left-0 bottom-0 w-64 bg-surface-raised border-r border-surface-border z-50 overflow-auto transition-transform duration-200 md:hidden',
                    open ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                {/* Close button */}
                <div className="flex items-center justify-between p-4 border-b border-surface-border">
                    <span className="text-sm font-bold tracking-widest text-accent-500 uppercase">
                        NeureCore
                    </span>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-surface-overlay rounded-lg transition"
                        aria-label="Close navigation"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nav items */}
                <div className="p-4">{children}</div>
            </nav>
        </>
    );
}

/**
 * MobileNavToggle — Hamburger button for opening drawer
 */
export function MobileNavToggle({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="md:hidden p-2 hover:bg-surface-overlay rounded-lg transition"
            aria-label="Open navigation menu"
        >
            <Menu className="w-5 h-5" />
        </button>
    );
}

export default MobileNav;
