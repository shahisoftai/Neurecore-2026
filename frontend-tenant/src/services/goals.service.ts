/**
 * goals.service.ts — Phase 3 Goal service
 *
 * Wraps the backend goals API for the tenant UI.
 */

import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export type GoalLevel = 'COMPANY' | 'DEPARTMENT' | 'TEAM' | 'INDIVIDUAL';
export type GoalStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';

export interface Goal {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  level: GoalLevel;
  status: GoalStatus;
  progress: number;
  parentId: string | null;
  ownerAgentId: string | null;
  ownerUserId: string | null;
  departmentId: string | null;
  projectId: string | null;
  targetDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  children?: Goal[];
}

export const goalsService = {
  async list(opts?: {
    status?: GoalStatus;
    level?: GoalLevel;
    departmentId?: string;
    projectId?: string;
    parentId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Goal[]; total: number }> {
    const res = await api.get('/goals', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as Goal[], total: total ?? items.length };
  },

  async get(id: string): Promise<Goal> {
    const res = await api.get(`/goals/${id}`);
    return unwrapItem(res) as Goal;
  },

  async getByProject(projectId: string): Promise<Goal[]> {
    const res = await api.get(`/goals/project/${projectId}`);
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : data;
    return Array.isArray(inner) ? (inner as Goal[]) : [];
  },

  async create(payload: {
    title: string;
    description?: string;
    level?: GoalLevel;
    parentId?: string;
    ownerAgentId?: string;
    ownerUserId?: string;
    departmentId?: string;
    projectId?: string;
    targetDate?: string;
  }): Promise<Goal> {
    const res = await api.post('/goals', payload);
    return unwrapItem(res) as Goal;
  },

  async update(id: string, payload: Partial<Goal>): Promise<Goal> {
    const res = await api.put(`/goals/${id}`, payload);
    return unwrapItem(res) as Goal;
  },

  async updateProgress(id: string, progress: number): Promise<Goal> {
    const res = await api.patch(`/goals/${id}/progress`, { progress });
    return unwrapItem(res) as Goal;
  },

  async recalculateProgress(id: string): Promise<Goal> {
    const res = await api.post(`/goals/${id}/recalculate-progress`);
    return unwrapItem(res) as Goal;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/goals/${id}`);
  },
};
