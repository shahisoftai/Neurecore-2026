/**
 * deptTemplates.service.ts
 *
 * SRP: Encapsulates all HTTP calls to /api/v1/department-templates and the
 *      deployment endpoint /api/v1/deploy/* .
 *      Components stay free of Axios / API knowledge.
 */

import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export interface DeptStructureItem {
  name: string;
  description?: string;
  headAgentType?: string;
  parentName?: string;
  agentTemplateNames?: string[];
}

export interface DepartmentTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  structure: DeptStructureItem[];
  isPublic: boolean;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeptTemplatePayload {
  name: string;
  slug: string;
  description?: string;
  structure: DeptStructureItem[];
  category?: string;
  tags?: string[];
  isPublic?: boolean;
}

export type UpdateDeptTemplatePayload = Partial<Omit<CreateDeptTemplatePayload, 'slug'>>;

// ─────────────────────────────────────────────────────────────────────────────
// Deployment payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkAgentDeployItem {
  templateId: string;
  name: string;
  departmentId?: string;
  budgetPerDay?: number;
  authorityLevel?: 'AUTO' | 'RECOMMEND' | 'APPROVAL';
}

export interface SpawnAgentPayload {
  name: string;
  tenantId: string;
  departmentId?: string;
  budgetPerDay?: number;
  authorityLevel?: 'AUTO' | 'RECOMMEND' | 'APPROVAL';
}

export const deptTemplatesService = {
  // ── CRUD ──────────────────────────────────────────────────────────────────

  async list(opts?: { category?: string; page?: number; limit?: number }) {
    const params: Record<string, unknown> = {};
    if (opts?.category) params.category = opts.category;
    if (opts?.page) params.page = opts.page;
    if (opts?.limit) params.limit = opts.limit;
    const res = await api.get('/department-templates', { params });
    return unwrapList(res) as { items: DepartmentTemplate[]; total: number; totalPages: number };
  },

  async get(id: string): Promise<DepartmentTemplate> {
    const res = await api.get(`/department-templates/${id}`);
    return unwrapItem(res) as DepartmentTemplate;
  },

  async create(payload: CreateDeptTemplatePayload): Promise<DepartmentTemplate> {
    const res = await api.post('/department-templates', payload);
    return unwrapItem(res) as DepartmentTemplate;
  },

  async update(id: string, payload: UpdateDeptTemplatePayload): Promise<DepartmentTemplate> {
    const res = await api.patch(`/department-templates/${id}`, payload);
    return unwrapItem(res) as DepartmentTemplate;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/department-templates/${id}`);
  },

  // ── Deployment ────────────────────────────────────────────────────────────

  /** Deploy a full department template to a tenant (creates real Department records) */
  async deployToTenant(tenantId: string, templateId: string, withAgents: boolean) {
    const res = await api.post(`/deploy/tenants/${tenantId}/dept-template`, {
      templateId,
      withAgents,
    });
    return unwrapItem(res) as { departments: number; agents: number; details: { id: string; name: string }[] };
  },

  /** Bulk-deploy multiple agents from platform templates to a tenant */
  async bulkDeployAgents(tenantId: string, agents: BulkAgentDeployItem[]) {
    const res = await api.post(`/deploy/tenants/${tenantId}/agents`, { agents });
    return unwrapItem(res) as { deployed: number; agents: unknown[] };
  },

  /** Spawn a single agent from a platform template */
  async spawnAgent(templateId: string, payload: SpawnAgentPayload) {
    const res = await api.post(`/deploy/agents/from-template/${templateId}`, payload);
    return unwrapItem(res) as { id: string; name: string; tenantId: string };
  },
};
