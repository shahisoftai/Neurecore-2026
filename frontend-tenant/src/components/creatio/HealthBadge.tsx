'use client';

/**
 * HealthBadge — Phase 6 Health Score indicator
 *
 * Shows composite health score (0-100) with color-coded severity:
 *   HEALTHY (≥70) → green
 *   WARNING (40-69) → yellow
 *   CRITICAL (<40) → red
 */

import { Activity } from 'lucide-react';
import type { ProjectHealth } from '@/services/project-health.service';

interface HealthBadgeProps {
  health: ProjectHealth | null;
  loading?: boolean;
  onRecalculate?: () => void;
}

const SEVERITY_CONFIG = {
  HEALTHY: {
    label: 'On Track',
    color: 'text-state-success',
    bg: 'bg-state-success/15',
    border: 'border-state-success/30',
  },
  WARNING: {
    label: 'At Risk',
    color: 'text-state-warning',
    bg: 'bg-state-warning/15',
    border: 'border-state-warning/30',
  },
  CRITICAL: {
    label: 'Critical',
    color: 'text-state-danger',
    bg: 'bg-state-danger/15',
    border: 'border-state-danger/30',
  },
};

export function HealthBadge({ health, loading, onRecalculate }: HealthBadgeProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-4 bg-surface-muted rounded animate-pulse" />
        <div className="w-6 h-4 bg-surface-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!health) {
    return (
      <button
        onClick={onRecalculate}
        className="flex items-center gap-1.5 px-2 py-1 rounded border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 hover:border-surface-overlay transition-colors"
        title="Compute health score"
      >
        <Activity className="w-3.5 h-3.5" />
        <span>Score Health</span>
      </button>
    );
  }

  const config = SEVERITY_CONFIG[health.severity] ?? SEVERITY_CONFIG.WARNING;
  const trendIcon =
    health.trend === 'IMPROVING' ? '↑' :
    health.trend === 'DEGRADING' ? '↓' : '→';

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded border ${config.bg} ${config.border} ${config.color}`}
    >
      <Activity className="w-3.5 h-3.5 shrink-0" />
      <span className="text-xs font-medium">{health.overallScore}</span>
      <span className="text-[10px] opacity-70">{trendIcon}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide">
        {config.label}
      </span>
    </div>
  );
}

/**
 * HealthScoreBar — visual score bar (0-100) with color fill.
 */
export function HealthScoreBar({ health }: { health: ProjectHealth }) {
  const pct = Math.min(100, Math.max(0, health.overallScore));
  const color =
    health.severity === 'HEALTHY' ? 'bg-state-success' :
    health.severity === 'CRITICAL' ? 'bg-state-danger' : 'bg-state-warning';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Health Score</span>
        <span className={`font-mono font-medium ${SEVERITY_CONFIG[health.severity]?.color ?? ''}`}>
          {health.overallScore}/100
        </span>
      </div>
      <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * SignalRow — individual health signal with mini bar.
 */
export function SignalRow({ signal }: { signal: { label: string; value: number; weight: number; detail?: string } }) {
  const color =
    signal.value >= 70 ? 'bg-state-success' :
    signal.value >= 40 ? 'bg-state-warning' : 'bg-state-danger';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-400 w-24 shrink-0 truncate">{signal.label}</span>
      <div className="flex-1 h-1 bg-surface-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${signal.value}%` }} />
      </div>
      <span className="font-mono text-zinc-300 w-8 text-right shrink-0">{signal.value}</span>
      {signal.detail && (
        <span className="text-zinc-500 text-[10px] italic truncate max-w-32" title={signal.detail}>
          {signal.detail}
        </span>
      )}
    </div>
  );
}
