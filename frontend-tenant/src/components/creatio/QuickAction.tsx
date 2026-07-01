'use client';

/**
 * QuickAction — Creatio-style large icon+label action card
 *
 * Phase 2 primitive. Used on the command center dashboard for primary
 * actions (open chat, run task, view inbox, etc.). Larger than a button,
 * visually distinct as a "quick action" affordance.
 */

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export interface QuickActionProps {
  label: string;
  description?: string;
  icon: ReactNode;
  /** Accent color — defaults to violet accent. */
  accent?: 'accent' | 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
  href?: string;
  /** Optional badge/notification count. */
  badge?: number | string;
  /** Disabled state. */
  disabled?: boolean;
  className?: string;
}

const ACCENT_CLASS: Record<NonNullable<QuickActionProps['accent']>, string> = {
  accent:  'bg-accent-500/10 text-accent-500 group-hover:bg-accent-500/20',
  success: 'bg-state-success/10 text-state-success group-hover:bg-state-success/20',
  warning: 'bg-state-warning/10 text-state-warning group-hover:bg-state-warning/20',
  danger:  'bg-state-danger/10 text-state-danger group-hover:bg-state-danger/20',
  info:    'bg-state-info/10 text-state-info group-hover:bg-state-info/20',
};

export function QuickAction({
  label,
  description,
  icon,
  accent = 'accent',
  onClick,
  href,
  badge,
  disabled = false,
  className = '',
}: QuickActionProps) {
  const content = (
    <>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition ${ACCENT_CLASS[accent]}`}>
        <span className="w-6 h-6">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-100 truncate">{label}</h3>
          {badge !== undefined && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-accent-500 text-white">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{description}</p>
        )}
      </div>
      <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-accent-500 transition shrink-0 ml-2" />
    </>
  );

  const baseClass = `group card-surface card-interactive p-4 flex items-start text-left ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`;

  if (href && !disabled) {
    return (
      <motion.a
        href={href}
        className={baseClass}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={baseClass}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {content}
    </motion.button>
  );
}