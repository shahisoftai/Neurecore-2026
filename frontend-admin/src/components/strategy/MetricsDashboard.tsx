'use client';

/**
 * MetricsDashboard.tsx — KPI summary tiles for a forecast result
 *
 * S: summary metric display only; no data fetching
 */

import type { ForecastSummary } from '@/types/strategy.types';

const fmt  = (v: number) => `$${(v / 1_000).toFixed(1)}k`;
const pct  = (v: number) => `${v.toFixed(1)}%`;

interface KPITileProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'profit' | 'risk' | 'neutral' | 'strategy';
}

function KPITile({ label, value, sub, accent = 'neutral' }: KPITileProps) {
  const accentClass = {
    profit:   'text-status-profit',
    risk:     'text-status-risk',
    strategy: 'text-status-strategy',
    neutral:  'text-zinc-100',
  }[accent];

  return (
    <div className="bg-surface-raised border border-surface-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold font-mono ${accentClass}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
}

interface Props {
  summary: ForecastSummary | null;
}

export function MetricsDashboard({ summary }: Props) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface-raised border border-surface-border rounded-xl p-4 h-20 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const marginAccent: KPITileProps['accent'] =
    summary.avgMarginPct >= 30 ? 'profit' : summary.avgMarginPct >= 10 ? 'strategy' : 'risk';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KPITile
        label="Total Revenue"
        value={fmt(summary.totalRevenue)}
        accent="profit"
      />
      <KPITile
        label="Total Cost"
        value={fmt(summary.totalCost)}
        accent="risk"
      />
      <KPITile
        label="Avg Margin"
        value={pct(summary.avgMarginPct)}
        accent={marginAccent}
      />
      <KPITile
        label="Peak Month"
        value={summary.peakMonth}
        sub={summary.breakEvenMonth ? `Break-even: ${summary.breakEvenMonth}` : 'No break-even'}
        accent="strategy"
      />
    </div>
  );
}
