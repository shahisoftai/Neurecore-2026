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
  // WS-2.1: locale fields surfaced at top level so updateState() can persist
  // them directly (controller passes them flat). Mirrors Tenant.timezone /
  // Tenant.currency schema columns.
  timezone?: string;
  currency?: string;
  tierId?: string;
  templateSlug?: string;
  departmentOverrides?: Record<string, { name?: string }>;
  agentOverrides?: Record<string, { name?: string; isSelected?: boolean }>;
  /**
   * INDUSTRY-SETUP-CONCEPT.md §3.1 G8 (Phase 1 G8) — true when the tenant
   * has previously completed onboarding (onboardingCompletedAt set).
   * Used by the wizard to render the company step as read-only on re-run.
   * Industry is a Super-Admin-only field per INDUSTRY-GROUPS-CONCEPT.md
   * §1.2 D7, so a re-running tenant must not be allowed to re-pick it.
   */
  isReRun?: boolean;
  /** Tenant.industry snapshot, so the wizard can render the current choice. */
  industry?: string | null;
  /** Tenant.industryGroup snapshot, for stub page routing. */
  industryGroup?: string | null;
}

export interface IOnboardingService {
  getState(tenantId: string): Promise<OnboardingStatePayload>;
  updateState(
    tenantId: string,
    partial: Partial<OnboardingStatePayload>,
  ): Promise<OnboardingStatePayload>;
  selectTier(
    tenantId: string,
    tierId: string,
  ): Promise<{ tier: { id: string; name: string; slug: string } }>;
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
