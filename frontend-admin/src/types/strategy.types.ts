'use client';

/**
 * strategy.types.ts — Strategy Room type contracts (admin portal)
 *
 * S: type definitions only; logic lives in services/stores
 */

export interface ScenarioParameters {
  tenantGrowth: number;       // 0–50 (percent)
  tokenMultiplier: number;    // 0.5–3.0
  modelAdoptionRate: number;  // 0–100 (percent)
  automationSavings: number;  // -50–50 (percent delta)
  forecastMonths: number;     // 3 | 6 | 12
}

export interface ForecastPoint {
  month: string;    // e.g. "Mar 2025"
  revenue: number;
  cost: number;
  margin: number;   // revenue - cost
  marginPct: number;
}

export interface ForecastSummary {
  totalRevenue: number;
  totalCost: number;
  avgMarginPct: number;
  peakMonth: string;
  breakEvenMonth: string | null;
}

export interface ForecastResult {
  points: ForecastPoint[];
  summary: ForecastSummary;
}

export interface Scenario {
  id: string;
  name: string;
  parameters: ScenarioParameters;
  result: ForecastResult;
  createdAt: string;
  color: string;
}
