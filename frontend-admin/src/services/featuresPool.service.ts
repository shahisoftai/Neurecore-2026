/**
 * Features Pool — Phase 10.
 */

import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';
import type { IPoolAdminService, PoolListOptions, PoolPage } from '@/lib/pool/IPoolAdminService';

export type FeatureCategory =
  | 'INTEGRATION'
  | 'API'
  | 'COMMUNICATION'
  | 'BRANDING'
  | 'ANALYTICS'
  | 'AUTOMATION'
  | 'SECURITY'
  | 'PLATFORM';

export interface Feature {
  id: string;
  key: string;
  name: string;
  description?: string;
  category: FeatureCategory;
  icon?: string;
  integrationKey?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeaturePayload {
  key: string;
  name: string;
  description?: string;
  category: FeatureCategory;
  icon?: string;
  integrationKey?: string;
  sortOrder?: number;
}

export const featuresPoolService: IPoolAdminService<Feature, CreateFeaturePayload> = {
  async list(opts: PoolListOptions = {}): Promise<PoolPage<Feature>> {
    const params: Record<string, unknown> = {};
    if (opts.page) params.page = opts.page;
    if (opts.limit) params.limit = opts.limit;
    if (opts.search) params.search = opts.search;
    if (opts.status) params.status = opts.status;
    if (opts.sortBy) params.sortBy = opts.sortBy;
    if (opts.sortDir) params.sortDir = opts.sortDir;

    const res = await api.get('/features', { params });
    const list = unwrapList(res);
    return {
      items: (list.items ?? []) as Feature[],
      total: list.total ?? 0,
      page: opts.page ?? 1,
      limit: opts.limit ?? 20,
      totalPages: Math.max(1, Math.ceil((list.total ?? 0) / (opts.limit ?? 20))),
    };
  },

  async get(id: string): Promise<Feature> {
    const res = await api.get(`/features/${id}`);
    return unwrapItem(res) as Feature;
  },

  async getBySlug(slug: string): Promise<Feature> {
    // Features use `key` as their public unique key, not slug.
    const res = await api.get(`/features/by-slug/${slug}`);
    return unwrapItem(res) as Feature;
  },

  async create(payload: CreateFeaturePayload): Promise<Feature> {
    const res = await api.post('/features', payload);
    return unwrapItem(res) as Feature;
  },

  async update(id: string, payload: Partial<CreateFeaturePayload>): Promise<Feature> {
    const res = await api.patch(`/features/${id}`, payload);
    return unwrapItem(res) as Feature;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/features/${id}`);
  },
};
