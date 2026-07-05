/**
 * Departments Pool — Phase 10.
 * Uses the new /departments-pool route; legacy /department-templates still works.
 */

import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';
import type { IPoolAdminService, PoolListOptions, PoolPage } from '@/lib/pool/IPoolAdminService';

export interface DeptPoolStructureItem {
  name: string;
  description?: string;
  headAgentType?: string;
  parentName?: string;
  agentTemplateNames?: string[];
}

export interface DepartmentPoolEntry {
  id: string;
  name: string;
  slug: string;
  description?: string;
  structure: DeptPoolStructureItem[];
  category: string;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentPoolPayload {
  name: string;
  slug: string;
  description?: string;
  structure: DeptPoolStructureItem[];
  category?: string;
  tags?: string[];
  isPublic?: boolean;
}

export const departmentsPoolService: IPoolAdminService<
  DepartmentPoolEntry,
  CreateDepartmentPoolPayload
> = {
  async list(opts: PoolListOptions = {}): Promise<PoolPage<DepartmentPoolEntry>> {
    const params: Record<string, unknown> = {};
    if (opts.page) params.page = opts.page;
    if (opts.limit) params.limit = opts.limit;
    if (opts.search) params.search = opts.search;
    if (opts.status) params.status = opts.status;
    if (opts.sortBy) params.sortBy = opts.sortBy;
    if (opts.sortDir) params.sortDir = opts.sortDir;

    const res = await api.get('/departments-pool', { params });
    const list = unwrapList(res);
    return {
      items: (list.items ?? []) as DepartmentPoolEntry[],
      total: list.total ?? 0,
      page: opts.page ?? 1,
      limit: opts.limit ?? 20,
      totalPages: Math.max(1, Math.ceil((list.total ?? 0) / (opts.limit ?? 20))),
    };
  },

  async get(id: string): Promise<DepartmentPoolEntry> {
    const res = await api.get(`/departments-pool/${id}`);
    return unwrapItem(res) as DepartmentPoolEntry;
  },

  async getBySlug(slug: string): Promise<DepartmentPoolEntry> {
    const res = await api.get(`/departments-pool/by-slug/${slug}`);
    return unwrapItem(res) as DepartmentPoolEntry;
  },

  async create(payload: CreateDepartmentPoolPayload): Promise<DepartmentPoolEntry> {
    const res = await api.post('/departments-pool', payload);
    return unwrapItem(res) as DepartmentPoolEntry;
  },

  async update(
    id: string,
    payload: Partial<CreateDepartmentPoolPayload>,
  ): Promise<DepartmentPoolEntry> {
    const res = await api.patch(`/departments-pool/${id}`, payload);
    return unwrapItem(res) as DepartmentPoolEntry;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/departments-pool/${id}`);
  },
};
