'use client';

/**
 * IndustryDashboardRenderer
 *
 * Stage 2 Phase 2A: Dynamic KPI dashboard rendering.
 *
 * Reads the dashboard template for the current tenant's industry group
 * and renders KPI cards, chart sections, and list widgets based on
 * the template definition. Fallback to "other" group if tenant group
 * is not recognized.
 *
 * SOLID:
 * - SRP: This component ONLY renders the dashboard layout from a template.
 * - OCP: New industry group = add entry to registry. Zero changes here.
 * - DIP: Depends on the DashboardTemplate abstraction, not on specific metrics.
 */

import { useMemo } from 'react';
import { KpiCard } from '@/components/creatio/KpiCard';
import {
  getDashboardTemplate,
  getDefaultDashboardTemplate,
} from '@/lib/dashboards/industry-dashboard.registry';
import type { KpiWidgetDef, ChartWidgetDef, ListWidgetDef } from '@/lib/dashboards/industry-dashboard.registry';

export interface IndustryDashboardRendererProps {
  industryGroup: string;
  metricValues: Record<string, { value: string | number; delta?: number; deltaLabel?: string }>;
  className?: string;
}

function formatValue(value: string | number, format?: 'number' | 'currency' | 'percent'): string {
  if (format === 'currency') {
    const num = typeof value === 'number' ? value : parseFloat(value as string);
    if (isNaN(num)) return String(value);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  }
  if (format === 'percent') {
    const num = typeof value === 'number' ? value : parseFloat(value as string);
    if (isNaN(num)) return String(value);
    return `${num}%`;
  }
  return String(value);
}

function KpiSection({
  widgets,
  metricValues,
}: {
  widgets: KpiWidgetDef[];
  metricValues: Record<string, { value: string | number; delta?: number; deltaLabel?: string }>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {widgets.map((widget) => {
        const data = metricValues[widget.metric] ?? { value: '—' };
        return (
          <KpiCard
            key={widget.metric}
            label={widget.label}
            value={formatValue(data.value, widget.format)}
            delta={data.delta}
            deltaLabel={data.deltaLabel}
            color={widget.color}
          />
        );
      })}
    </div>
  );
}

function ChartSection({ widgets }: { widgets: ChartWidgetDef[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
      {widgets.map((widget) => (
        <div
          key={widget.metric}
          className="card-surface p-5 min-h-[250px] flex items-center justify-center"
        >
          <div className="text-center text-zinc-500">
            <p className="text-sm font-medium">{widget.label}</p>
            <p className="text-xs mt-1 text-zinc-600">
              {widget.type} chart — {widget.period ?? 'daily'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSection({ widgets }: { widgets: ListWidgetDef[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
      {widgets.map((widget) => (
        <div key={widget.type} className="card-surface p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">{widget.label}</h3>
          <div className="space-y-2">
            {Array.from({ length: widget.maxItems }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-surface-border last:border-0"
              >
                <div className="flex-1">
                  <div className="h-3 w-3/4 bg-surface-muted rounded animate-pulse" />
                </div>
                <div className="h-3 w-12 bg-surface-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function IndustryDashboardRenderer({
  industryGroup,
  metricValues,
  className = '',
}: IndustryDashboardRendererProps) {
  const template = useMemo(
    () => getDashboardTemplate(industryGroup) ?? getDefaultDashboardTemplate(),
    [industryGroup],
  );

  const hasPhase2D = !!(
    template.phase2dKpiWidgets?.length ||
    template.phase2dChartWidgets?.length ||
    template.phase2dListWidgets?.length
  );

  return (
    <div className={className}>
      <KpiSection widgets={template.kpiWidgets} metricValues={metricValues} />
      <ChartSection widgets={template.chartWidgets} />
      <ListSection widgets={template.listWidgets} />

      {hasPhase2D && (
        <div className="mt-8 border-t border-surface-border pt-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
            Advanced Analytics
            <span className="text-[10px] px-2 py-0.5 rounded bg-accent-500/15 text-accent-500 font-medium">
              Phase 2D
            </span>
          </h3>
          {template.phase2dKpiWidgets && template.phase2dKpiWidgets.length > 0 && (
            <KpiSection widgets={template.phase2dKpiWidgets} metricValues={metricValues} />
          )}
          {template.phase2dChartWidgets && template.phase2dChartWidgets.length > 0 && (
            <ChartSection widgets={template.phase2dChartWidgets} />
          )}
          {template.phase2dListWidgets && template.phase2dListWidgets.length > 0 && (
            <ListSection widgets={template.phase2dListWidgets} />
          )}
        </div>
      )}
    </div>
  );
}

export function IndustryDashboardFallback({ className = '' }: { className?: string }) {
  const template = getDefaultDashboardTemplate();

  return (
    <div className={className}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {template.kpiWidgets.map((widget) => (
          <KpiCard
            key={widget.metric}
            label={widget.label}
            value="—"
            color="neutral"
            loading
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {template.chartWidgets.map((widget) => (
          <div key={widget.metric} className="card-surface p-5 min-h-[250px] animate-pulse flex items-center justify-center">
            <div className="h-4 w-32 bg-surface-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
