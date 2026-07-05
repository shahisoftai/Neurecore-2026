export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  meta: { timestamp: string; requestId: string };
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface TenantTier {
  id: string;
  slug: string;
  name: string;
  maxAgents: number;
  maxDepartments: number;
  monthlyPrice?: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  /** @deprecated use `tier.slug` (Phase 6) — kept for legacy admin UI. */
  plan?: string;
  /** @deprecated use `tier.maxAgents` (Phase 6) — kept for legacy admin UI. */
  agentLimit?: number;
  status: string;
  /** Phase 6 billing-tier rollup; preferred over `plan` / `agentLimit`. */
  tier?: TenantTier;
  createdAt: string;
}
