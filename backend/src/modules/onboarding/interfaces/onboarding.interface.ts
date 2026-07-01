import type { UserRole } from '@prisma/client';

export type OnboardingStep =
  | 'account'
  | 'company'
  | 'plan'
  | 'template'
  | 'review'
  | 'team'
  | 'complete';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'account',
  'company',
  'plan',
  'template',
  'review',
  'team',
  'complete',
];

export interface OnboardingCompanyInfo {
  name?: string;
  logoUrl?: string;
  timezone?: string;
  currency?: string;
  industry?: string;
}

export interface OnboardingStatePayload {
  step: OnboardingStep;
  company?: OnboardingCompanyInfo;
  tierId?: string;
  templateSlug?: string;
  departmentOverrides?: Record<string, { name?: string }>;
  agentOverrides?: Record<string, { name?: string; isSelected?: boolean }>;
}

export interface IOnboardingService {
  getState(tenantId: string): Promise<OnboardingStatePayload>;
  updateState(
    tenantId: string,
    partial: Partial<OnboardingStatePayload>,
  ): Promise<OnboardingStatePayload>;
  selectTier(tenantId: string, tierId: string): Promise<{ tier: { id: string; name: string; slug: string } }>;
  selectTemplate(
    tenantId: string,
    templateSlug: string,
    overrides?: OnboardingStatePayload['agentOverrides'],
  ): Promise<{
    departmentsCreated: number;
    agentsCreated: number;
  }>;
  inviteMembers(
    tenantId: string,
    invitedById: string,
    invites: Array<{ email: string; role: UserRole }>,
  ): Promise<{ tokens: string[] }>;
  acceptInvite(
    token: string,
    payload: { firstName: string; lastName: string; password: string },
  ): Promise<{ userId: string; tenantId: string }>;
  complete(tenantId: string): Promise<{ completedAt: Date }>;
}