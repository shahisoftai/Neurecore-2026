/** Describes the result of a quota evaluation */
export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  /** Soft-limit threshold (0–1). Emit a warning when used/limit ≥ this value. */
  warningThreshold: number;
  atWarning: boolean;
}

/** Identifies a quota target */
export interface QuotaTarget {
  tenantId: string;
  agentId?: string;
  quotaKey: string;
  period?: string; // hourly | daily | monthly | lifetime
}

/**
 * IQuotaService
 * Abstraction for per-tenant / per-agent quota management.
 * SRP: this interface exposes query + recording concerns only.
 *      Enforcement is the responsibility of QuotaEnforcerService.
 */
export interface IQuotaService {
  /** Check current usage without mutating state */
  evaluate(target: QuotaTarget): Promise<QuotaCheck>;

  /** Record N units of usage (default 1); returns updated check */
  record(target: QuotaTarget, units?: number): Promise<QuotaCheck>;

  /** Reset usage counter for a given target */
  reset(target: QuotaTarget): Promise<void>;

  /** Upsert the limit for a quota key */
  setLimit(target: QuotaTarget, limit: number): Promise<void>;
}

export const QUOTA_SERVICE = Symbol('IQuotaService');
