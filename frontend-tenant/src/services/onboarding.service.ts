import api from './api';

export type OnboardingStep =
  | 'account'
  | 'company'
  | 'plan'
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
};