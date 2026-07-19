// ─── strategy.service.ts (extracted from legacy chat.service.ts) ────────────────
// SRP: Scenario forecasting API + local fallback only.
// Was incorrectly co-located in chat.service.ts.

import api from './api';
import { unwrapArrayOrEmpty } from './unwrap';
import type {
  ScenarioParameters,
  ForecastResult,
  ForecastPoint,
} from '@/types/strategy.types';

function makeId(): string {
  return `scn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const strategyService = {
  async forecast(params: ScenarioParameters): Promise<ForecastResult> {
    try {
      const res = await api.post<{ data: ForecastResult }>('/strategy/forecast', { parameters: params });
      return (res as { data?: { data?: ForecastResult } }).data?.data ?? buildLocalForecast(params);
    } catch {
      return buildLocalForecast(params);
    }
  },

  async saveScenario(
    name: string,
    description: string,
    params: ScenarioParameters,
  ): Promise<{ id: string; name: string; createdAt: string }> {
    try {
      const res = await api.post<{ data: { id: string; name: string; createdAt: string } }>('/strategy/scenarios', {
        name, description, parameters: params,
      });
      return (res as { data?: { data?: { id: string; name: string; createdAt: string } } }).data?.data ?? {
        id: makeId(), name, createdAt: new Date().toISOString(),
      };
    } catch {
      return { id: makeId(), name, createdAt: new Date().toISOString() };
    }
  },

  async listScenarios(): Promise<Array<{ id: string; name: string; createdAt: string }>> {
    try {
      const res = await api.get<{ data: { data: unknown[] } }>('/strategy/scenarios');
      return unwrapArrayOrEmpty(res) as Array<{ id: string; name: string; createdAt: string }>;
    } catch {
      return [];
    }
  },

  async deleteScenario(id: string): Promise<void> {
    try {
      await api.delete(`/strategy/scenarios/${id}`);
    } catch {
      /* no-op */
    }
  },
};

/** Local forecast fallback when backend strategy endpoint is not deployed */
function buildLocalForecast(params: ScenarioParameters): ForecastResult {
  const months = params.forecastMonths;
  const baseTenants = 20;
  const baseRevPerTenant = 299;
  const baseCostPerAgent = 45;
  const baseAgents = baseTenants * 3;
  const growthRate = params.tenantGrowth / 100;
  const savingsFactor = 1 + params.automationSavings / 100;

  const points: ForecastPoint[] = Array.from({ length: months }, (_, i) => {
    const m = i + 1;
    const label = new Date(Date.now() + m * 30 * 86400000)
      .toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const tenants = Math.round(baseTenants * (1 + growthRate) ** m);
    const agents = Math.round(baseAgents * params.tokenMultiplier);
    const revenue = Math.round(tenants * baseRevPerTenant * (1 + params.modelAdoptionRate / 200));
    const cost = Math.round(agents * baseCostPerAgent * params.tokenMultiplier * savingsFactor);
    const margin = revenue - cost;
    const marginPct = revenue > 0 ? parseFloat(((margin / revenue) * 100).toFixed(1)) : 0;
    return { month: label, revenue, cost, margin, marginPct };
  });

  const totalRevenue = points.reduce((s, p) => s + p.revenue, 0);
  const totalCost = points.reduce((s, p) => s + p.cost, 0);
  const avgMarginPct = points.length
    ? parseFloat((points.reduce((s, p) => s + p.marginPct, 0) / points.length).toFixed(1))
    : 0;
  const peakPoint = points.reduce((best, p) => (p.revenue > best.revenue ? p : best), points[0]);
  const breakEvenPoint = points.find((p) => p.margin >= 0) ?? null;

  return {
    points,
    summary: {
      totalRevenue,
      totalCost,
      avgMarginPct,
      peakMonth: peakPoint?.month ?? '',
      breakEvenMonth: breakEvenPoint?.month ?? null,
    },
  };
}
