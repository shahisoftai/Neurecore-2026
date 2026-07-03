/**
 * Admin Pool — type contracts (per `memory-bank-new/admin-pool.md`).
 *
 * SOLID:
 *  - SRP — this file owns ONLY the shape of pool catalog + package entities.
 *  - ISP — read DTOs are thin projections; preview is separate from catalog.
 *  - DIP — services depend on these types, not on raw Prisma rows.
 */

import type { Industry } from '@prisma/client';

/** Mirrors Prisma `Industry` enum (additive migration). */
export type IndustryValue = Industry;

/** Stable label map for the UI (also referenced by FE for `<select>` options). */
export const INDUSTRY_LABELS: ReadonlyArray<{
  value: IndustryValue;
  label: string;
}> = [
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'ECOMMERCE', label: 'E-commerce' },
  { value: 'SAAS', label: 'SaaS' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'MARKETING_AGENCY', label: 'Marketing Agency' },
  { value: 'CONSULTING', label: 'Consulting' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'GENERAL', label: 'General' },
];

/** Thin projection of a PoolDepartment row (returned by GET /admin/pool/departments). */
export interface PoolDepartmentDto {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  agentCount: number;
}

/** Query options for the PoolAgent list endpoint. */
export interface ListPoolAgentsOptions {
  division?: string;
  divisionSlug?: string;
  q?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

/** Paginated result envelope (mirrors `common/responses/paginated.response`). */
export interface Paginated<T> {
  items: T[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

/** Thin projection of a PoolAgent row (returned by GET /admin/pool/agents). */
export interface PoolAgentDto {
  id: string;
  slug: string;
  name: string;
  division: string;
  divisionSlug: string;
  description: string | null;
  category: string | null;
  emoji: string | null;
  color: string | null;
  isActive: boolean;
  systemPrompt: string;
  metadata: Record<string, unknown>;
  version: string;
  packageEntryCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Per-entry payload sent by FA when saving the package drawer. */
export interface IndustryPackageEntryPayload {
  poolAgentId: string;
  divisionSlug: string;
  slot?: number;
  isRequired?: boolean;
  isDefaultSelected?: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
}

/** Full IndustryPackage returned by GET /admin/industry-packages/:id. */
export interface IndustryPackageDto {
  id: string;
  industry: IndustryValue;
  tierId: string;
  tierSlug: string;
  tierName: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isRecommended: boolean;
  entries: IndustryPackageEntryDto[];
  entryCount: number;
  requiredCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IndustryPackageEntryDto {
  id: string;
  poolAgentId: string;
  poolAgentName: string;
  poolAgentSlug: string;
  divisionSlug: string;
  slot: number;
  isRequired: boolean;
  isDefaultSelected: boolean;
  defaultBudgetPerDay: number | null;
  defaultModel: string | null;
}

/** Preview payload returned to the FA matrix cell + the FT onboarding wizard. */
export interface IndustryPackagePreview {
  packageId: string;
  industry: IndustryValue;
  tierId: string;
  tierSlug: string;
  name: string;
  isRecommended: boolean;
  degraded: boolean;
  agents: PoolAgentDto[];
  divisions: Array<{
    divisionSlug: string;
    name: string;
    icon: string | null;
    color: string | null;
    agents: PoolAgentDto[];
  }>;
  tierCapacity: {
    maxAgents: number;
    maxDepartments: number;
    overAgentLimit: boolean;
    overDepartmentLimit: boolean;
  };
}
