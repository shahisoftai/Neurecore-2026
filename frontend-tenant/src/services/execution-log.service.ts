/**
 * execution-log.service.ts — Phase 4: Task Execution Log
 *
 * Wraps the backend execution-log API for the tenant UI.
 */

import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export type TaskExecutionLogEntry = {
  id: string;
  taskId: string;
  agentId: string | null;
  action: string;
  actorType: string;
  actorId: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export const executionLogService = {
  async create(payload: {
    taskId: string;
    agentId?: string;
    action: string;
    actorType?: string;
    actorId?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  }): Promise<TaskExecutionLogEntry> {
    const res = await api.post('/execution-log', payload);
    return unwrapItem(res) as TaskExecutionLogEntry;
  },

  async list(opts?: {
    taskId?: string;
    agentId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: TaskExecutionLogEntry[]; total: number }> {
    const res = await api.get('/execution-log', { params: opts });
    return unwrapList(res) as { items: TaskExecutionLogEntry[]; total: number };
  },

  async getByTask(taskId: string): Promise<TaskExecutionLogEntry[]> {
    const res = await api.get(`/execution-log/task/${taskId}`);
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : data;
    return Array.isArray(inner) ? (inner as TaskExecutionLogEntry[]) : [];
  },
};
