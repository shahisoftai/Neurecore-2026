import api from './api';

export interface Tier {
  id: string;
  name: string;
  slug: string;
  description?: string;
  // Phase 2 G14 — tagline persisted by the backend (see tier.dto.ts).
  // Used by TierBadge when compact=false to surface a 1-line plan summary.
  tagline?: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  maxUsers: number;
  maxAgents: number;
  maxDepartments: number;
  maxStorageGB: number;
  maxApiCalls: number;
  maxFileSizeMB: number;
  isDefault?: boolean;
  isActive?: boolean;
  // Phase 2 G15 — null for paid tiers, integer days for trial tiers.
  trialDays?: number | null;
  // Phase 2 G15 — billing cycle ('monthly' | 'yearly').
  billingCycle?: string;
}

export interface TierChangeRequestResponse {
  requestId: string;
  direction: 'UPGRADE' | 'DOWNGRADE' | 'SAME_TIER';
  status: 'PENDING';
  toTier: { id: string; slug: string; name: string };
}

export const tiersService = {
  async list(): Promise<Tier[]> {
    const res = await api.get('/tiers');
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : (payload?.items ?? []);
  },

  /**
   * Phase 6 — tenant-self-service tier change REQUEST.
   * Creates a PENDING TierChangeRequest row that SuperAdmin must approve.
   * Does NOT mutate Tenant.tierId directly (per INDUSTRY-GROUPS-CONCEPT.md
   * §1.2 D7 — tier change is SuperAdmin-only).
   */
  async requestTierChange(
    toTierId: string,
    reason?: string,
  ): Promise<TierChangeRequestResponse> {
    const res = await api.post('/tenants/me/tier-change-requests', {
      toTierId,
      reason,
    });
    const data = res.data?.data ?? res.data;
    return data as TierChangeRequestResponse;
  },
};