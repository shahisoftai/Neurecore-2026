import api from './api';

export type OnboardingStep =
  | 'account'
  | 'company'
  | 'plan'
  | 'package'
  | 'template'
  | 'review'
  | 'team'
  | 'complete';

export interface OnboardingState {
  step: OnboardingStep;
  tierId?: string;
  company?: {
    name?: string;
    logoUrl?: string;
    industry?: string;
  };
  templateSlug?: string;
}

export interface SelectTemplateResult {
  departmentsCreated: number;
  agentsCreated: number;
}

export interface InviteResult {
  tokens: string[];
}

export interface AcceptInviteResult {
  userId: string;
  tenantId: string;
}

export interface DeployPackageResult {
  departmentsCreated: number;
  agentsCreated: number;
  packageName: string;
}

export interface IndustryLabel { value: string; label: string }

export const onboardingService = {
  async getState(): Promise<OnboardingState> {
    const res = await api.get('/onboarding/state');
    return res.data?.data ?? res.data;
  },

  async updateState(partial: Partial<OnboardingState>): Promise<OnboardingState> {
    const res = await api.put('/onboarding/state', partial);
    return res.data?.data ?? res.data;
  },

  async selectTier(tierId: string): Promise<{ tier: { id: string; name: string; slug: string } }> {
    const res = await api.post('/onboarding/select-tier', { tierId });
    return res.data?.data ?? res.data;
  },

  async selectTemplate(
    templateSlug: string,
    agentOverrides?: Record<string, { name?: string; isSelected?: boolean }>,
  ): Promise<SelectTemplateResult> {
    const res = await api.post('/onboarding/select-template', {
      templateSlug,
      agentOverrides,
    });
    return res.data?.data ?? res.data;
  },

  async inviteMembers(
    invites: Array<{ email: string; role?: 'USER' | 'ADMIN' }>,
  ): Promise<InviteResult> {
    const res = await api.post('/onboarding/invite', { invites });
    return res.data?.data ?? res.data;
  },

  async complete(): Promise<{ completedAt: string }> {
    const res = await api.post('/onboarding/complete');
    return res.data?.data ?? res.data;
  },

  async acceptInvite(
    token: string,
    payload: { firstName: string; lastName: string; password: string },
  ): Promise<AcceptInviteResult> {
    const res = await api.post(`/onboarding/accept-invite/${token}`, payload);
    return res.data?.data ?? res.data;
  },

  async listIndustries(): Promise<IndustryLabel[]> {
    const res = await api.get('/admin/industries');
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : (payload?.items ?? []);
  },

  async recommendPackage(
    industry: string,
    tierId: string,
  ): Promise<Record<string, unknown> | null> {
    const res = await api.get('/onboarding/recommend', {
      params: { industry, tierId },
    });
    return res.data?.data ?? null;
  },

  async deployPackage(
    packageId: string,
    selections?: Record<string, { isSelected?: boolean; name?: string }>,
  ): Promise<DeployPackageResult> {
    const res = await api.post('/onboarding/deploy-package', {
      packageId,
      selections,
    });
    return res.data?.data ?? res.data;
  },
};