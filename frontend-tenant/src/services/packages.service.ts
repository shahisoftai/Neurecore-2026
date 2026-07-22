// services/packages.service.ts — Tenant-facing package browser + deploy
// Tenants can list PUBLISHED packages matching their industry/tier and deploy them.
//
// TIER-SYSTEM-CONCEPT.md Phase 3: `tierId` (canonical) replaces `tierTemplateId`.

import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export interface TenantPackage {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  scope: string;
  version: number;
  industryId: string;
  tierId: string;
  industry?: { name: string; slug: string };
  tier?: { name: string; slug: string };
  departments?: Array<{ id: string; name: string }>;
  agents?: Array<{ id: string; name: string }>;
  features?: Array<{ id: string; name: string; key: string }>;
  suggestedAgentCount?: number | null;
  suggestedDepartmentCount?: number | null;
}

export interface DeployPackagePreview {
  feasible: boolean;
  blockers: string[];
  totals: { departments: number; agents: number; features: number };
  capacity: {
    departmentsUsed: number; departmentsLimit: number;
    agentsUsed: number; agentsLimit: number;
    departmentsRemaining: number; agentsRemaining: number;
  };
}

export interface DeployPackageOptions {
  withAgents?: boolean;
  authorityLevel?: 'AUTO' | 'RECOMMEND' | 'APPROVAL';
  idempotent?: boolean;
}

export interface DeployPackageOutcome {
  package: { id: string; slug: string; name: string; version: number };
  tenantId: string;
  departments: { reused: number; created: number; items: Array<{ id: string; name: string; templateId: string; reused: boolean }> };
  agents: { skipped: number; created: number; items: Array<{ id: string; name: string; templateId: string; reused: boolean }> };
  authorityLevel: string;
  idempotent: boolean;
  deployedAt: string;
}

export interface TenantFeature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  isEnabled: boolean;
}

export const packagesService = {
  async list(params?: { search?: string; status?: string; page?: number; limit?: number }): Promise<TenantPackage[]> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit ?? 50));
    const res = await api.get(`/packages?${q.toString()}`);
    const data = unwrapList(res);
    return (Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []) as TenantPackage[];
  },

  async getById(id: string): Promise<TenantPackage> {
    const res = await api.get(`/packages/${id}`);
    return unwrapItem(res) as TenantPackage;
  },

  async deployPreview(packageId: string, tenantId: string, withAgents?: boolean): Promise<DeployPackagePreview> {
    const q = new URLSearchParams({ packageId, tenantId });
    if (withAgents !== undefined) q.set('withAgents', String(withAgents));
    const res = await api.get(`/packages/deploy/preview?${q.toString()}`);
    return unwrapItem(res) as DeployPackagePreview;
  },

  async deploy(packageId: string, tenantId: string, options?: DeployPackageOptions): Promise<DeployPackageOutcome> {
    const res = await api.post('/packages/deploy', {
      packageId,
      tenantId,
      ...options,
    });
    return unwrapItem(res) as DeployPackageOutcome;
  },

  async listFeatures(): Promise<TenantFeature[]> {
    const res = await api.get('/features');
    const data = unwrapList(res);
    return (Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []) as TenantFeature[];
  },
};
