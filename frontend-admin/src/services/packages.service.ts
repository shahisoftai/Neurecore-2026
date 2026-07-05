/**
 * packages.service.ts — Phase 10 Packages Pool (composite root).
 *
 * Implements the IPoolAdminService contract for standard CRUD PLUS exposes
 * the composition-specific endpoints that don't fit the generic interface.
 */

import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';
import type { Feature } from '@/services/featuresPool.service';
import type { Industry } from '@/services/industriesPool.service';
import type { TierTemplate } from '@/services/tiersPool.service';
import type { DepartmentPoolEntry } from '@/services/departmentsPool.service';
import type { AgentsPoolEntry } from '@/services/agentsPool.service';
import type { IPoolAdminService, PoolListOptions, PoolPage } from '@/lib/pool/IPoolAdminService';

export type PackageStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Package {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: PackageStatus;
  sortOrder: number;
  industryId: string;
  tierTemplateId: string;
  suggestedAgentCount?: number | null;
  suggestedDepartmentCount?: number | null;
  industry?: Industry;
  tierTemplate?: TierTemplate;
  departments?: DepartmentPoolEntry[];
  aiAgents?: AgentsPoolEntry[];
  features?: Feature[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePackagePayload {
  slug: string;
  name: string;
  description?: string;
  status?: PackageStatus;
  sortOrder?: number;
  industryId: string;
  tierTemplateId: string;
}

export interface UpdatePackagePayload {
  name?: string;
  description?: string;
  status?: PackageStatus;
  sortOrder?: number;
}

export interface PackageComposition {
  departmentIds?: string[];
  aiAgentIds?: string[];
  featureIds?: string[];
  suggestedAgentCount?: number;
  suggestedDepartmentCount?: number;
}

export interface PackagePreviewResult {
  valid: boolean;
  totals: { departments: number; agents: number; features: number };
  missing: { departments: string[]; agents: string[]; features: string[] };
  categories: Record<string, number>;
}

export const packagesService = {
  async list(opts: PoolListOptions = {}): Promise<PoolPage<Package>> {
    const params: Record<string, unknown> = {};
    if (opts.page) params.page = opts.page;
    if (opts.limit) params.limit = opts.limit;
    if (opts.search) params.search = opts.search;
    if (opts.status) params.status = opts.status;
    if (opts.sortBy) params.sortBy = opts.sortBy;
    if (opts.sortDir) params.sortDir = opts.sortDir;

    const res = await api.get('/packages', { params });
    const list = unwrapList(res);
    return {
      items: (list.items ?? []) as Package[],
      total: list.total ?? 0,
      page: opts.page ?? 1,
      limit: opts.limit ?? 20,
      totalPages: Math.max(1, Math.ceil((list.total ?? 0) / (opts.limit ?? 20))),
    };
  },

  async get(id: string): Promise<Package> {
    const res = await api.get(`/packages/${id}`);
    return unwrapItem(res) as Package;
  },

  async getBySlug(slug: string): Promise<Package> {
    const res = await api.get(`/packages/by-slug/${slug}`);
    return unwrapItem(res) as Package;
  },

  async create(payload: CreatePackagePayload): Promise<Package> {
    const res = await api.post('/packages', payload);
    return unwrapItem(res) as Package;
  },

  async update(id: string, payload: UpdatePackagePayload): Promise<Package> {
    const res = await api.patch(`/packages/${id}`, payload);
    return unwrapItem(res) as Package;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/packages/${id}`);
  },

  /** Phase 10 — replace composition M2M atomically. */
  async updateComposition(id: string, body: PackageComposition): Promise<Package> {
    const res = await api.patch(`/packages/${id}/composition`, body);
    return unwrapItem(res) as Package;
  },

  /** Phase 10 — dry-run preview without writing. */
  async preview(
    industryId: string,
    tierTemplateId: string,
    composition: PackageComposition,
  ): Promise<PackagePreviewResult> {
    const res = await api.post('/packages/preview', {
      industryId,
      tierTemplateId,
      ...composition,
    });
    return unwrapItem(res) as PackagePreviewResult;
  },
} satisfies IPoolAdminService<Package, CreatePackagePayload> & {
  updateComposition(id: string, body: PackageComposition): Promise<Package>;
  preview(
    industryId: string,
    tierTemplateId: string,
    composition: PackageComposition,
  ): Promise<PackagePreviewResult>;
};
