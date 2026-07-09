/**
 * project-health.service.ts — Phase 6 Health Score + BI Dashboards
 *
 * Wraps the backend project-health API for the tenant UI.
 */

import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export type HealthSeverity = 'HEALTHY' | 'WARNING' | 'CRITICAL';
export type HealthTrend = 'IMPROVING' | 'STABLE' | 'DEGRADING';
export type HealthSignalName = 'budgetBurn' | 'timeline' | 'activityRate' | 'approvalDelay' | 'reworkRate';

export interface HealthSignal {
  name: HealthSignalName;
  value: number;
  weight: number;
  label: string;
  detail?: string;
}

export interface ProjectHealth {
  projectId: string;
  tenantId: string;
  overallScore: number;
  severity: HealthSeverity;
  trend: HealthTrend;
  signals: HealthSignal[];
  atRiskReasons: string[];
  computedAt: string;
}

export interface CustomerMargin {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
  projectCount: number;
}

export interface IndustryMargin {
  industry: string;
  totalRevenue: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
  projectCount: number;
}

export interface AnalyticsRollup {
  tenantId: string;
  period: '30d' | '90d' | '1y' | 'all';
  marginByCustomer: CustomerMargin[];
  marginByIndustry: IndustryMargin[];
  winRate: number;
  winRateTrend: HealthTrend;
  avgCycleTimeDays: number;
  cycleTimeTrend: HealthTrend;
  activeProjects: number;
  atRiskProjects: number;
  completedProjects: number;
  computedAt: string;
}

export interface Bottleneck {
  entityType: 'STAGE' | 'APPROVER_ROLE';
  entityId: string;
  entityLabel: string;
  avgWaitHours: number;
  projectCount: number;
  trend: 'worsening' | 'stable' | 'improving';
}

export const projectHealthService = {
  async getHealth(projectId: string): Promise<ProjectHealth | null> {
    const res = await api.get(`/project-health/project/${projectId}`);
    return (unwrapItem(res) as ProjectHealth) ?? null;
  },

  async recalculateHealth(projectId: string): Promise<ProjectHealth> {
    const res = await api.post(`/project-health/project/${projectId}/recalculate`);
    return unwrapItem(res) as ProjectHealth;
  },

  async getAtRiskProjects(threshold?: number): Promise<ProjectHealth[]> {
    const params = threshold !== undefined ? { threshold } : {};
    const res = await api.get('/project-health/at-risk', { params });
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : data;
    return Array.isArray(inner) ? (inner as ProjectHealth[]) : [];
  },

  async getAnalytics(period: '30d' | '90d' | '1y' | 'all' = '30d'): Promise<AnalyticsRollup> {
    const res = await api.get('/project-health/analytics', { params: { period } });
    return unwrapItem(res) as AnalyticsRollup;
  },

  async getBottlenecks(): Promise<Bottleneck[]> {
    const res = await api.get('/project-health/bottlenecks');
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : data;
    return Array.isArray(inner) ? (inner as Bottleneck[]) : [];
  },
};
