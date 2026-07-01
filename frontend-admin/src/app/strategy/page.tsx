'use client';

/**
 * Strategy Room — /strategy
 *
 * Platform financial forecast under configurable growth scenarios.
 *
 * S: page wires components together; business logic in useStrategy hook
 * D: all data via strategyService (injected through hook); no direct API calls here
 */

import { ScenarioBuilder }    from '@/components/strategy/ScenarioBuilder';
import { ForecastChart }       from '@/components/strategy/ForecastChart';
import { MetricsDashboard }    from '@/components/strategy/MetricsDashboard';
import { ScenarioComparison }  from '@/components/strategy/ScenarioComparison';
import { useStrategy }         from '@/hooks/useStrategy';

export default function StrategyPage() {
  const {
    scenarios,
    current,
    loading,
    error,
    runForecast,
    deleteScenario,
    setCurrentScenario,
  } = useStrategy();

  return (
    <div className="h-full flex flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Strategy Room</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Model platform growth scenarios and forecast financial outcomes over time.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-status-risk/40 bg-status-risk/10 px-4 py-3 text-sm text-status-risk">
          {error}
        </div>
      )}

      {/* KPI summary */}
      <MetricsDashboard summary={current?.result.summary ?? null} />

      {/* Main layout: builder left, chart right */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        {/* Parameter builder */}
        <section className="bg-surface-raised border border-surface-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
            Scenario Parameters
          </h2>
          <ScenarioBuilder onRun={runForecast} loading={loading} />
        </section>

        {/* Chart */}
        <section className="bg-surface-raised border border-surface-border rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            {current ? `Forecast — ${current.name}` : 'Forecast Projection'}
          </h2>
          <ForecastChart points={current?.result.points ?? []} />
        </section>
      </div>

      {/* Scenario comparison */}
      <section className="bg-surface-raised border border-surface-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
          Saved Scenarios
        </h2>
        <ScenarioComparison
          scenarios={scenarios}
          currentId={current?.id ?? null}
          onSelect={setCurrentScenario}
          onDelete={deleteScenario}
        />
      </section>
    </div>
  );
}
