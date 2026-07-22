/**
 * Tier Interface - SOLID: Interface Segregation Principle
 *
 * SRP: Defines only tier-related contracts
 * OCP: New tier operations extend via this interface
 * DIP: Service depends on abstraction, not concretion
 *
 * Phase 2 G14 + G15: extended CreateTierInput with every field the FE
 * admin UI sends (tagline, icon, billingCycle, trialDays, maxDepartments,
 * maxApprovalStages, allowWhiteLabel, allowPredictiveAnalytics,
 * allowCustomDashboards, allowMultiOffice). The field list mirrors the
 * canonical FE type CreateTierPayload 1:1 so the contract is enforced
 * at the type level — the service cannot silently drop fields again.
 */

import type { Tier, TierAgentPool, AgentTemplate } from '@prisma/client';
import type { BillingCycle } from '../dto/tier.dto';

export interface ITierLimits {
  maxUsers: number;
  maxAgents: number;
  maxDepartments: number;
  maxStorageGB: number;
  maxApiCalls: number;
  maxConversationMessages: number;
  maxFileSizeMB: number;
  maxApprovalStages: number;
}

export interface ITierFeatures {
  allowCustomBranding: boolean;
  allowApiAccess: boolean;
  allowSso: boolean;
  allowAuditExport: boolean;
  allowWhiteLabel: boolean;
  allowPredictiveAnalytics: boolean;
  allowCustomDashboards: boolean;
  allowMultiOffice: boolean;
}

export interface ITierPricing {
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  billingCycle: BillingCycle;
}

export interface TierWithPoolCount extends Tier {
  _count: {
    tierAgentPools: number;
    tenants: number;
  };
}

export interface TierWithPools extends Tier {
  tierAgentPools: (TierAgentPool & {
    template: AgentTemplate;
  })[];
}

/**
 * SRP: CreateTierInput is the EXACT union of columns Tier.create accepts.
 * Adding a new schema column means: (1) add to the DTO, (2) add here, (3)
 * add to the `TIER_INPUT_FIELDS` constant in tier.dto.ts that drives the
 * service's spread. No column should appear on the Prisma model without
 * also appearing in all three places — that's the contract.
 */
export interface CreateTierInput {
  name: string;
  slug: string;
  description?: string;
  tagline?: string;
  icon?: string;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  monthlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  billingCycle?: BillingCycle;
  trialDays?: number;
  maxUsers?: number;
  maxAgents?: number;
  maxDepartments?: number;
  maxStorageGB?: number;
  maxApiCalls?: number;
  maxConversationMessages?: number;
  maxFileSizeMB?: number;
  maxApprovalStages?: number;
  allowCustomBranding?: boolean;
  allowApiAccess?: boolean;
  allowSso?: boolean;
  allowAuditExport?: boolean;
  allowWhiteLabel?: boolean;
  allowPredictiveAnalytics?: boolean;
  allowCustomDashboards?: boolean;
  allowMultiOffice?: boolean;
}

export type UpdateTierInput = Partial<CreateTierInput>;

export interface ITierService {
  // Read operations
  findAll(): Promise<TierWithPoolCount[]>;
  findById(id: string): Promise<TierWithPools | null>;
  findBySlug(slug: string): Promise<TierWithPools | null>;
  getDefault(): Promise<Tier | null>;

  // Write operations
  create(input: CreateTierInput): Promise<Tier>;
  update(id: string, input: UpdateTierInput): Promise<Tier>;
  delete(id: string): Promise<void>;

  // State operations
  toggleActive(id: string, isActive: boolean): Promise<Tier>;
  setDefault(id: string): Promise<Tier>;
  reorder(ids: string[]): Promise<Tier[]>;
}
