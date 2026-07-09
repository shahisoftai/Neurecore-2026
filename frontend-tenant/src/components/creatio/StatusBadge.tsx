'use client';

/**
 * StatusBadge — Creatio-style status pill
 *
 * Phase 2 primitive. Color-coded pill used to communicate entity status
 * (ACTIVE, PAUSED, ERROR, ARCHIVED, DEPRECATED, etc.). Uses semantic
 * state-* CSS vars for theme-aware coloring.
 *
 * Maps domain status strings to state colors:
 *   - success / active / running / completed / paid / healthy → success
 *   - warning / paused / pending / draft / archived / inactive → warning
 *   - danger / error / failed / cancelled / terminated → danger
 *   - info / info / queued / info → info
 *   - default / unknown → neutral
 */

import { type ReactNode } from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusBadgeProps {
  /** Status string from the domain (e.g. 'ACTIVE', 'FAILED', 'ARCHIVED'). */
  status: string;
  /** Optional override for the mapped variant. */
  variant?: BadgeVariant;
  /** Optional icon. */
  icon?: ReactNode;
  /** Optional size. */
  size?: 'sm' | 'md';
  /** Optional custom label — defaults to status string. */
  label?: string;
  className?: string;
}

const STATUS_MAP: Record<string, BadgeVariant> = {
  // Success states
  ACTIVE: 'success',
  RUNNING: 'success',
  COMPLETED: 'success',
  PAID: 'success',
  HEALTHY: 'success',
  WARNING: 'warning',
  CRITICAL: 'danger',
  PASS: 'success',
  SUCCESS: 'success',
  ENABLED: 'success',
  SELECTED: 'success',

  // Warning states
  PAUSED: 'warning',
  PENDING: 'warning',
  DRAFT: 'warning',
  QUEUED: 'warning',
  ARCHIVED: 'warning',
  DEPRECATED: 'warning',
  INACTIVE: 'warning',
  IDLE: 'warning',
  DISABLED: 'warning',
  IN_REVIEW: 'warning',

  // Danger states
  ERROR: 'danger',
  FAILED: 'danger',
  CANCELLED: 'danger',
  TERMINATED: 'danger',
  EXPIRED: 'danger',
  RISK: 'danger',
  BLOCKED: 'danger',
  OVERDUE: 'danger',
  REJECTED: 'danger',

  // Info states
  INFO: 'info',
  PROCESSING: 'info',
  REVIEW: 'info',
  TRIAL: 'info',
  APPROVED: 'success',

  // Neutral states (default)
  UNKNOWN: 'neutral',
  NEW: 'neutral',
};

const VARIANT_BG: Record<BadgeVariant, string> = {
  success: 'bg-state-success/15 text-state-success border-state-success/30',
  warning: 'bg-state-warning/15 text-state-warning border-state-warning/30',
  danger: 'bg-state-danger/15 text-state-danger border-state-danger/30',
  info: 'bg-state-info/15 text-state-info border-state-info/30',
  neutral: 'bg-surface-overlay text-zinc-400 border-surface-border',
};

const VARIANT_DOT: Record<BadgeVariant, string> = {
  success: 'bg-state-success',
  warning: 'bg-state-warning',
  danger: 'bg-state-danger',
  info: 'bg-state-info',
  neutral: 'bg-zinc-500',
};

export function StatusBadge({
  status,
  variant,
  icon,
  size = 'sm',
  label,
  className = '',
}: StatusBadgeProps) {
  const resolvedVariant = variant ?? STATUS_MAP[status.toUpperCase()] ?? 'neutral';
  const displayLabel = label ?? status;
  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClass} ${VARIANT_BG[resolvedVariant]} ${className}`}
    >
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${VARIANT_DOT[resolvedVariant]}`} />
      )}
      <span className="uppercase tracking-wide">{displayLabel}</span>
    </span>
  );
}

/**
 * Phase 2 helper: pass any domain status to get a Color-coded badge.
 * Wraps StatusBadge with default mappings.
 */
export function StatusPill({ status, ...rest }: { status: string } & Omit<StatusBadgeProps, 'status'>) {
  return <StatusBadge status={status} {...rest} />;
}