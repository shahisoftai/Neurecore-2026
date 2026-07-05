import api from './api';

export type OnboardingStep =
  | 'account'
  | 'company'
  | 'logo'
  | 'localization'
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
  /** WS-2.1: PR-2 exposes these so the wizard can resume correctly. */
  timezone?: string;
  currency?: string;
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

  /**
   * WS-2.1: Persist company + locale fields via the dedicated owner-scoped
   * endpoint. Used by the Tier-1 wizard after collecting Tier-1-only fields.
   */
  async saveCompanyAndLocale(payload: {
    name?: string;
    logoUrl?: string | null;
    industry?: string;
    timezone?: string;
    currency?: string;
    locale?: string;
    dateFormat?: string;
    timeFormat?: string;
    fiscalYearStart?: string;
  }): Promise<void> {
    await api.patch('/tenants/me', payload);
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