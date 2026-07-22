import api from './api';

export interface IndustryGroup {
  slug: string;
  label: string;
  icon: string;
  sortOrder: number;
  description: string;
  industries?: IndustryOption[];
}

export interface IndustryOption {
  slug: string;
  name: string;
  description?: string;
  industryGroup?: string;
  groupSortOrder?: number;
}

export interface CapabilityResponse {
  industry: { slug: string; name: string; industryGroup: string };
  tier: 'basic' | 'business' | 'professional' | 'enterprise';
  capabilities: {
    maxAgents: number;
    maxDepartments: number;
    maxStorageGB: number;
    maxApprovalStages: number;
    activeAgentSlugs: string[];
    packageTiersAvailable: string[];
    projectTypesVisible: string[];
    integrationsAvailable: string[];
    featureFlags: string[];
    description: string;
  };
}

/**
 * industriesService — client for `/api/v1/industries/...` public endpoints.
 *
 * SRP: only industry-group / capability lookups used by onboarding +
 * the Plan Impact panel. The /tiers/:id endpoint (tenant's resolved
 * capabilities) lives in tiers.service.ts.
 */
export const industriesService = {
  async listGroups(): Promise<IndustryGroup[]> {
    const res = await api.get('/industries/groups');
    return (res.data?.data ?? res.data ?? []) as IndustryGroup[];
  },

  async getCapabilities(
    industrySlug: string,
    tierSlug: string,
  ): Promise<CapabilityResponse | null> {
    if (!industrySlug || !tierSlug) return null;
    const res = await api.get(
      `/industries/${encodeURIComponent(industrySlug)}/capabilities`,
      { params: { tier: tierSlug } },
    );
    return (res.data?.data ?? res.data ?? null) as CapabilityResponse | null;
  },
};
