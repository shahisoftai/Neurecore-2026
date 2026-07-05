/**
 * Industries Pool — Phase 10.
 * DIP: implements IPoolAdminService. Components import only the interface.
 */

import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';
import type { IPoolAdminService, PoolListOptions, PoolPage } from '@/lib/pool/IPoolAdminService';

export interface Industry {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIndustryPayload {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  status?: Industry['status'];
  sortOrder?: number;
}

export const industriesPoolService: IPoolAdminService<Industry, CreateIndustryPayload> = {
  async list(opts: PoolListOptions = {}): Promise<PoolPage<Industry>> {
    const params: Record<string, unknown> = {};
    if (opts.page) params.page = opts.page;
    if (opts.limit) params.limit = opts.limit;
    if (opts.search) params.search = opts.search;
    if (opts.status) params.status = opts.status;
    if (opts.sortBy) params.sortBy = opts.sortBy;
    if (opts.sortDir) params.sortDir = opts.sortDir;

    const res = await api.get('/industries', { params });
    const list = unwrapList(res);
    return {
      items: (list.items ?? []) as Industry[],
      total: list.total ?? 0,
      page: opts.page ?? 1,
      limit: opts.limit ?? 20,
      totalPages: Math.max(1, Math.ceil((list.total ?? 0) / (opts.limit ?? 20))),
    };
  },

  async get(id: string): Promise<Industry> {
    const res = await api.get(`/industries/${id}`);
    return unwrapItem(res) as Industry;
  },

  async getBySlug(slug: string): Promise<Industry> {
    const res = await api.get(`/industries/by-slug/${slug}`);
    return unwrapItem(res) as Industry;
  },

  async create(payload: CreateIndustryPayload): Promise<Industry> {
    const res = await api.post('/industries', payload);
    return unwrapItem(res) as Industry;
  },

  async update(id: string, payload: Partial<CreateIndustryPayload>): Promise<Industry> {
    const res = await api.patch(`/industries/${id}`, payload);
    return unwrapItem(res) as Industry;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/industries/${id}`);
  },
};
