/**
 * industryPackages.service.ts — API client for /api/v1/admin/industry-packages/*.
 *
 * SRP: Encapsulates HTTP. Components stay free of Axios knowledge.
 */

import api from './api';
import { unwrapList, unwrapItem } from './unwrap';

export interface Industry {
  value: string;
  label: string;
}

export interface IndustryPackageEntry {
  id: string;
  poolAgentId: string;
  poolAgentName: string;
  poolAgentSlug: string;
  divisionSlug: string;
  slot: number;
  isRequired: boolean;
  isDefaultSelected: boolean;
  defaultBudgetPerDay: number | null;
  defaultModel: string | null;
}

export interface IndustryPackage {
  id: string;
  industry: string;
  tierId: string;
  tierSlug: string;
  tierName: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isRecommended: boolean;
  entries: IndustryPackageEntry[];
  entryCount: number;
  requiredCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IndustryPackagePreview {
  packageId: string;
  industry: string;
  tierId: string;
  tierSlug: string;
  name: string;
  isRecommended: boolean;
  degraded: boolean;
  agents: Array<{
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
  }>;
  divisions: Array<{
    divisionSlug: string;
    name: string;
    icon: string | null;
    color: string | null;
    agents: Array<{
      id: string;
      name: string;
      division: string;
      isActive: boolean;
    }>;
  }>;
  tierCapacity: {
    maxAgents: number;
    maxDepartments: number;
    overAgentLimit: boolean;
    overDepartmentLimit: boolean;
  };
}

export interface IndustryPackageEntryPayload {
  poolAgentId: string;
  divisionSlug: string;
  slot?: number;
  isRequired?: boolean;
  isDefaultSelected?: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
}

export interface CreateIndustryPackagePayload {
  industry: string;
  tierId: string;
  name: string;
  description?: string;
}

export const industryPackagesService = {
  async listIndustries(): Promise<Industry[]> {
    const res = await api.get('/admin/industries');
    return (unwrapList(res).items as Industry[]) ?? [];
  },

  async list(opts?: { industry?: string; tierId?: string; isActive?: boolean }): Promise<IndustryPackage[]> {
    const params: Record<string, unknown> = {};
    if (opts?.industry) params.industry = opts.industry;
    if (opts?.tierId) params.tierId = opts.tierId;
    if (opts?.isActive !== undefined) params.isActive = opts.isActive;
    const res = await api.get('/admin/industry-packages', { params });
    return (unwrapList(res).items as IndustryPackage[]) ?? [];
  },

  async getOne(id: string): Promise<IndustryPackage> {
    const res = await api.get(`/admin/industry-packages/${id}`);
    return unwrapItem(res) as IndustryPackage;
  },

  async create(data: CreateIndustryPackagePayload): Promise<IndustryPackage> {
    const res = await api.post('/admin/industry-packages', data);
    return unwrapItem(res) as IndustryPackage;
  },

  async update(id: string, data: { name?: string; description?: string; isActive?: boolean; isRecommended?: boolean }): Promise<IndustryPackage> {
    const res = await api.patch(`/admin/industry-packages/${id}`, data);
    return unwrapItem(res) as IndustryPackage;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/admin/industry-packages/${id}`);
  },

  async replaceEntries(id: string, entries: IndustryPackageEntryPayload[]): Promise<IndustryPackage> {
    const res = await api.put(`/admin/industry-packages/${id}/entries`, { entries });
    return unwrapItem(res) as IndustryPackage;
  },

  async preview(industry: string, tierId: string): Promise<IndustryPackagePreview | null> {
    const res = await api.get('/admin/industry-packages/preview', { params: { industry, tierId } });
    return (res.data?.data ?? null) as IndustryPackagePreview | null;
  },
};
