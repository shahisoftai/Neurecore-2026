/**
 * pool.service.ts — API client for /api/v1/admin/pool/departments + /agents.
 *
 * SRP: Encapsulates HTTP. Components stay free of Axios knowledge.
 */

import api from './api';
import { unwrapList, unwrapItem } from './unwrap';

export interface PoolDepartment {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  agentCount: number;
}

export interface PoolAgent {
  id: string;
  slug: string;
  name: string;
  division: string;
  divisionSlug: string;
  description: string | null;
  category: string | null;
  emoji: string | null;
  color: string | null;
  isActive: boolean;
  systemPrompt: string;
  metadata: Record<string, unknown>;
  version: string;
  packageEntryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PoolAgentList {
  items: PoolAgent[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export interface CreatePoolAgentPayload {
  name: string;
  division: string;
  divisionSlug: string;
  description?: string;
  category?: string;
  emoji?: string;
  color?: string;
  systemPrompt: string;
  version?: string;
}

export type UpdatePoolAgentPayload = Partial<CreatePoolAgentPayload & { isActive: boolean }>;

export type UpdatePoolDepartmentPayload = Partial<{
  name: string;
  icon: string;
  color: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}>;

export const poolService = {
  async listDepartments(): Promise<PoolDepartment[]> {
    const res = await api.get('/admin/pool/departments');
    return (unwrapList(res).items as PoolDepartment[]) ?? [];
  },

  async getDepartment(id: string): Promise<PoolDepartment> {
    const res = await api.get(`/admin/pool/departments/${id}`);
    return unwrapItem(res) as PoolDepartment;
  },

  async updateDepartment(id: string, data: UpdatePoolDepartmentPayload): Promise<PoolDepartment> {
    const res = await api.patch(`/admin/pool/departments/${id}`, data);
    return unwrapItem(res) as PoolDepartment;
  },

  async listAgents(opts?: { division?: string; divisionSlug?: string; q?: string; page?: number; limit?: number }): Promise<PoolAgentList> {
    const params: Record<string, unknown> = {};
    if (opts?.division) params.division = opts.division;
    if (opts?.divisionSlug) params.divisionSlug = opts.divisionSlug;
    if (opts?.q) params.q = opts.q;
    if (opts?.page) params.page = opts.page;
    if (opts?.limit) params.limit = opts.limit;
    const res = await api.get('/admin/pool/agents', { params });
    return res.data?.data ?? { items: [], total: 0, totalPages: 0, page: 1, limit: 20 };
  },

  async getAgent(id: string): Promise<PoolAgent> {
    const res = await api.get(`/admin/pool/agents/${id}`);
    return unwrapItem(res) as PoolAgent;
  },

  async createAgent(data: CreatePoolAgentPayload): Promise<PoolAgent> {
    const res = await api.post('/admin/pool/agents', data);
    return unwrapItem(res) as PoolAgent;
  },

  async updateAgent(id: string, data: UpdatePoolAgentPayload): Promise<PoolAgent> {
    const res = await api.patch(`/admin/pool/agents/${id}`, data);
    return unwrapItem(res) as PoolAgent;
  },

  async removeAgent(id: string): Promise<void> {
    await api.delete(`/admin/pool/agents/${id}`);
  },
};
