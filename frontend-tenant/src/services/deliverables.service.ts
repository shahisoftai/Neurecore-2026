/**
 * deliverables.service.ts — Phase 3 Deliverables service
 *
 * Wraps the backend deliverables API for the tenant UI.
 */

import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export type DeliverableStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Deliverable {
  id: string;
  projectId: string;
  taskId: string | null;
  goalId: string | null;
  name: string;
  description: string | null;
  status: DeliverableStatus;
  riskTier: RiskTier | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliverableVersion {
  id: string;
  deliverableId: string;
  version: number;
  content: Record<string, unknown>;
  summary: string | null;
  producedBy: string | null;
  producedByTaskId: string | null;
  createdAt: string;
}

export interface DeliverableWithVersions extends Deliverable {
  versions: DeliverableVersion[];
}

export const deliverablesService = {
  async list(opts?: {
    projectId?: string;
    goalId?: string;
    status?: DeliverableStatus;
    page?: number;
    limit?: number;
  }): Promise<{ items: Deliverable[]; total: number }> {
    const res = await api.get('/deliverables', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as Deliverable[], total: total ?? items.length };
  },

  async get(id: string): Promise<Deliverable> {
    const res = await api.get(`/deliverables/${id}`);
    return unwrapItem(res) as Deliverable;
  },

  async getByProject(projectId: string): Promise<Deliverable[]> {
    const res = await api.get('/deliverables', { params: { projectId, limit: 100 } });
    const { items } = unwrapList(res);
    return items as Deliverable[];
  },

  async create(payload: {
    projectId: string;
    taskId?: string;
    goalId?: string;
    name: string;
    description?: string;
    status?: DeliverableStatus;
    riskTier?: RiskTier;
  }): Promise<Deliverable> {
    const res = await api.post('/deliverables', payload);
    return unwrapItem(res) as Deliverable;
  },

  async update(id: string, payload: Partial<Deliverable>): Promise<Deliverable> {
    const res = await api.patch(`/deliverables/${id}`, payload);
    return unwrapItem(res) as Deliverable;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/deliverables/${id}`);
  },

  // ─── Version operations ───────────────────────────────────────────────────

  async listVersions(deliverableId: string): Promise<DeliverableVersion[]> {
    const res = await api.get(`/deliverables/${deliverableId}/versions`);
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : data;
    return Array.isArray(inner) ? (inner as DeliverableVersion[]) : [];
  },

  async getLatestVersion(deliverableId: string): Promise<DeliverableVersion | null> {
    const res = await api.get(`/deliverables/${deliverableId}/versions/latest`);
    return unwrapItem(res) as DeliverableVersion | null;
  },

  async createVersion(
    deliverableId: string,
    payload: {
      content: Record<string, unknown>;
      summary?: string;
      producedBy?: string;
      producedByTaskId?: string;
    },
  ): Promise<DeliverableVersion> {
    const res = await api.post(`/deliverables/${deliverableId}/versions`, payload);
    return unwrapItem(res) as DeliverableVersion;
  },
};
