/**
 * AdminMetricsService — D (Dependency Inversion) principle
 * All admin analytics fetching is abstracted here.
 * Components depend on this interface, never on the raw api module.
 */

import api from './api';
import { unwrapArrayOrEmpty } from './unwrap';
import type { PlatformKpis, TimeSeriesPoint, BarDataPoint } from '@/types/ui.types';

interface TenantSummary {
  id: string;
  name?: string;
  status?: string;
  isActive?: boolean;
  monthlyBudget?: number;
  budget?: number;
}

interface AgentSummary {
  status?: string;
  monthlyBudget?: number;
  budget?: number;
}

interface TaskSummary {
  status?: string;
}

export interface AdminMetricsSummary {
  totalTenants: number;
  activeTenants: number;
  totalAgents: number;
  runningAgents: number;
  totalUsers: number;
  tasksToday: number;
  errorRate: number;
  avgResponseMs: number;
  totalCostUsd: number;
  revenueUsd: number;
}

export interface TenantMetricRow {
  id: string;
  name: string;
  agentCount: number;
  taskCount: number;
  costUsd: number;
  status: string;
}

class AdminMetricsService {
  private logError(context: string, err: unknown): void {
    console.warn(`[adminMetricsService] ${context}:`, err instanceof Error ? err.message : err);
  }

  async getPlatformKpis(): Promise<PlatformKpis> {
    const [tenants, agents, tasks] = await Promise.all([
      api.get<{ data: unknown[] }>('/tenants').catch((err) => {
        this.logError('getPlatformKpis /tenants', err);
        return { data: [] as unknown[] };
      }),
      api.get<{ data: unknown[] }>('/agents').catch((err) => {
        this.logError('getPlatformKpis /agents', err);
        return { data: [] as unknown[] };
      }),
      api.get<{ data: unknown[] }>('/tasks?limit=500').catch((err) => {
        this.logError('getPlatformKpis /tasks', err);
        return { data: [] as unknown[] };
      }),
    ]);

    const tenantList = unwrapArrayOrEmpty(tenants) as TenantSummary[];
    const agentList = unwrapArrayOrEmpty(agents) as AgentSummary[];
    const taskList = unwrapArrayOrEmpty(tasks) as TaskSummary[];

    const activeTenants = tenantList.filter(
      (t) => t.status === 'ACTIVE' || t.isActive,
    ).length;
    const runningAgents = agentList.filter(
      (a) => a.status === 'ACTIVE' || a.status === 'RUNNING',
    ).length;
    const completedTasks = taskList.filter((t) => t.status === 'COMPLETED').length;
    const failedTasks = taskList.filter((t) => t.status === 'FAILED').length;
    const totalTasksWithOutcome = completedTasks + failedTasks;
    const successRate =
      totalTasksWithOutcome > 0
        ? Math.round((completedTasks / totalTasksWithOutcome) * 100)
        : 0;

    const totalCost = agentList.reduce(
      (sum, a) => sum + (a.monthlyBudget ?? a.budget ?? 0),
      0,
    );

    return {
      totalTenants: tenantList.length,
      activeTenants,
      activeAgents: runningAgents,
      totalAgents: agentList.length,
      runningAgents,
      successRate,
      tasksPerHour: 0,
      errorRate: 0,
      avgLatencyMs: 0,
      totalCostUsd: totalCost,
      costToday: Math.round(totalCost / 30),
      revenueUsd: totalCost * 1.3,
      revenueToday: Math.round(totalCost * 1.3 / 30),
    };
  }

  async getTimeSeriesData(
    metric: 'tasks' | 'errors' | 'cost' | 'agents',
    range: '24h' | '7d' | '30d',
  ): Promise<TimeSeriesPoint[]> {
    const points = range === '24h' ? 24 : range === '7d' ? 7 : 30;
    const now = Date.now();
    const interval = range === '24h' ? 3_600_000 : 86_400_000;

    return Array.from({ length: points }, (_, i) => ({
      ts: new Date(now - (points - 1 - i) * interval).toISOString(),
      value: 0,
    }));
  }

  async getTenantCostBreakdown(): Promise<BarDataPoint[]> {
    const tenants = await api
      .get<{ data: unknown[] }>('/tenants')
      .catch((err) => {
        this.logError('getTenantCostBreakdown', err);
        return { data: [] as unknown[] };
      });
    const list = unwrapArrayOrEmpty(tenants) as TenantSummary[];

    return list.slice(0, 10).map((t, i) => ({
      label: t.name ?? `Tenant ${i + 1}`,
      value: t.monthlyBudget ?? t.budget ?? 0,
      color: i % 2 === 0 ? '#6366f1' : '#8b5cf6',
    }));
  }
}

export const adminMetricsService = new AdminMetricsService();
