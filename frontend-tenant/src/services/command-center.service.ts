// ─── commandCenterService.ts ─────────────────────────────────────────────────
// Aggregates the data the command-center dashboard needs in a single
// round-trip. Replaces 7 parallel HTTP requests with one.
// Phase 2 R3 performance fix.

import { restClient } from '@/core/services/api/clients/RestClient';
import { unwrapItem } from '@/services/unwrap';

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
    return unwrapItem(res) as CommandCenterSummary;
  },
};
