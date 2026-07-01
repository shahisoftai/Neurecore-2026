/**
 * Tier Interface - SOLID: Interface Segregation Principle
 *
 * SRP: Defines only tier-related contracts
 * OCP: New tier operations extend via this interface
 * DIP: Service depends on abstraction, not concretion
 */

import type { Tier, TierAgentPool, AgentTemplate } from '@prisma/client';

export interface ITierLimits {
  maxUsers: number;
  maxAgents: number;
  maxStorageGB: number;
  maxApiCalls: number;
  maxConversationMessages: number;
  maxFileSizeMB: number;
}

export interface ITierFeatures {
  allowCustomBranding: boolean;
  allowApiAccess: boolean;
  allowSso: boolean;
  allowAuditExport: boolean;
}

export interface ITierPricing {
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
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

export interface CreateTierInput {
  name: string;
  slug: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  monthlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  maxUsers?: number;
  maxAgents?: number;
  maxStorageGB?: number;
  maxApiCalls?: number;
  maxConversationMessages?: number;
  maxFileSizeMB?: number;
  allowCustomBranding?: boolean;
  allowApiAccess?: boolean;
  allowSso?: boolean;
  allowAuditExport?: boolean;
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
