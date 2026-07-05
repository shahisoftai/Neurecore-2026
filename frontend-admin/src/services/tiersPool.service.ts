/**
 * Tier Templates Pool — Phase 10.
 */

import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';
import type { IPoolAdminService, PoolListOptions, PoolPage } from '@/lib/pool/IPoolAdminService';

export interface TierTemplate {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  sortOrder: number;
  defaultBillingTierId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTierTemplatePayload {
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  status?: TierTemplate['status'];
  sortOrder?: number;
  defaultBillingTierId?: string;
}

export const tiersPoolService: IPoolAdminService<TierTemplate, CreateTierTemplatePayload> = {
  async list(opts: PoolListOptions = {}): Promise<PoolPage<TierTemplate>> {
    const params: Record<string, unknown> = {};
    if (opts.page) params.page = opts.page;
    if (opts.limit) params.limit = opts.limit;
    if (opts.search) params.search = opts.search;
    if (opts.status) params.status = opts.status;
    if (opts.sortBy) params.sortBy = opts.sortBy;
    if (opts.sortDir) params.sortDir = opts.sortDir;

    const res = await api.get('/tier-templates', { params });
    const list = unwrapList(res);
    return {
      items: (list.items ?? []) as TierTemplate[],
      total: list.total ?? 0,
      page: opts.page ?? 1,
      limit: opts.limit ?? 20,
      totalPages: Math.max(1, Math.ceil((list.total ?? 0) / (opts.limit ?? 20))),
    };
  },

  async get(id: string): Promise<TierTemplate> {
    const res = await api.get(`/tier-templates/${id}`);
    return unwrapItem(res) as TierTemplate;
  },

  async getBySlug(slug: string): Promise<TierTemplate> {
    const res = await api.get(`/tier-templates/by-slug/${slug}`);
    return unwrapItem(res) as TierTemplate;
  },

  async create(payload: CreateTierTemplatePayload): Promise<TierTemplate> {
    const res = await api.post('/tier-templates', payload);
    return unwrapItem(res) as TierTemplate;
  },

  async update(id: string, payload: Partial<CreateTierTemplatePayload>): Promise<TierTemplate> {
    const res = await api.patch(`/tier-templates/${id}`, payload);
    return unwrapItem(res) as TierTemplate;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/tier-templates/${id}`);
  },
};
