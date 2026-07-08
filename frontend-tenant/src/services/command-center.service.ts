// ─── commandCenterService.ts ─────────────────────────────────────────────────
// Aggregates the data the command-center dashboard needs in a single
// round-trip. Replaces 7 parallel HTTP requests with one.
// Phase 2 R3 performance fix.

import { restClient } from '@/core/services/api/clients/RestClient';
import { unwrapItem } from '@/services/unwrap';

function ensureArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? v : [];
}

export interface CommandCenterAgent {
  id: string;
  name: string;
  type: string;
  status: string;
  model: string | null;
  departmentId: string | null;
  _count: { tasks: number };
}

export interface CommandCenterTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  agentId: string | null;
  createdAt: string;
}

export interface CommandCenterWorkflow {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface CommandCenterDepartment {
  id: string;
  name: string;
  status: string;
}

export interface CommandCenterSummary {
  agents: {
    total: number;
    active: number;
    running: number;
    paused: number;
    error: number;
    list: CommandCenterAgent[];
  };
  tasks: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    list: CommandCenterTask[];
  };
  workflows: {
    total: number;
    active: number;
    list: CommandCenterWorkflow[];
  };
  departments: {
    total: number;
    list: CommandCenterDepartment[];
  };
  approvals: { pending: number };
  costs: { monthCents: number; budgetCents: number };
  activity: Array<{
    id: string;
    message: string;
    severity: string;
    timestamp: string;
  }>;
  fetchedAt: string;
}

export const commandCenterService = {
  /**
   * Fetch the full command-center summary in one request.
   * Replaces 7 parallel fetches (agents/tasks/workflows/departments/
   * logs/approvals/costs).
   */
  async getSummary(): Promise<CommandCenterSummary> {
    const res = await restClient.get('/command-center/summary');
    const data = unwrapItem(res);
    if (!data || typeof data !== 'object') {
      throw new Error('command-center/summary returned invalid data');
    }
    const d = data as Record<string, unknown>;
    return {
      agents: { total: (d.agents as { total?: number })?.total ?? 0, active: (d.agents as { active?: number })?.active ?? 0, running: (d.agents as { running?: number })?.running ?? 0, paused: (d.agents as { paused?: number })?.paused ?? 0, error: (d.agents as { error?: number })?.error ?? 0, list: ensureArray((d.agents as { list?: unknown[] })?.list) },
      tasks: { total: (d.tasks as { total?: number })?.total ?? 0, pending: (d.tasks as { pending?: number })?.pending ?? 0, running: (d.tasks as { running?: number })?.running ?? 0, completed: (d.tasks as { completed?: number })?.completed ?? 0, failed: (d.tasks as { failed?: number })?.failed ?? 0, list: ensureArray((d.tasks as { list?: unknown[] })?.list) },
      workflows: { total: (d.workflows as { total?: number })?.total ?? 0, active: (d.workflows as { active?: number })?.active ?? 0, list: ensureArray((d.workflows as { list?: unknown[] })?.list) },
      departments: { total: (d.departments as { total?: number })?.total ?? 0, list: ensureArray((d.departments as { list?: unknown[] })?.list) },
      approvals: { pending: (d.approvals as { pending?: number })?.pending ?? 0 },
      costs: { monthCents: (d.costs as { monthCents?: number })?.monthCents ?? 0, budgetCents: (d.costs as { budgetCents?: number })?.budgetCents ?? 0 },
      activity: ensureArray(d.activity as unknown[] | undefined) as CommandCenterSummary['activity'],
      fetchedAt: (d.fetchedAt as string) ?? new Date().toISOString(),
    };
  },
};
