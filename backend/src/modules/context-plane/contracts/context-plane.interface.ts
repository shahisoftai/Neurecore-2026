/**
 * Organizational Context Plane — contracts (ADR-002, Phase 3).
 *
 * The Context Plane AGGREGATES authorized context from capability-owned
 * providers. It owns aggregation + authorization resolution + caching only.
 * It never owns capability data or business logic, and never queries capability
 * tables directly (architecture test enforces this).
 */

// ── Authorization decision (ADR-002 / ADR-012) ──────────────────────────────

export type ContextAccess = 'FULL' | 'REDACTED' | 'DENIED';

export interface ContextAuthorization {
  access: ContextAccess;
  /** Human-readable reason for the decision. */
  reason: string;
  /** Which policy/rule/boundary produced the decision. */
  policySource: string;
  /** Actor the decision was made for. */
  actorId: string;
  /** Capability the decision applies to. */
  capability: string;
  /** The scope requested. */
  scope: ContextScope;
  /** ISO 8601 decision time. */
  decidedAt: string;
}

// ── Identity + auth resolution (ADR-002 §6) ─────────────────────────────────

export type EmployeeType = 'HUMAN' | 'AI_AGENT';

export interface ResolvedIdentity {
  employeeId: string;
  employeeType: EmployeeType;
  displayName: string;
  role: string; // resolved organizational role (e.g. Hermes type, or human role)
  departmentId: string | null;
  departmentName: string | null;
  authorityLevel: number; // 0-100 base authority
  autonomyLevel: number; // 0-100 base autonomy
  /** How identity was resolved (provenance). null-safe. */
  resolvedFrom: string;
}

export interface GovernancePolicyRef {
  ruleId: string;
  effect: string;
}

export interface AuthContext {
  applicablePolicies: GovernancePolicyRef[];
  effectiveAuthority: number;
  effectiveAutonomy: number;
  /** true when governance blocked the actor (effective autonomy forced to 0). */
  governanceBlocked: boolean;
}

/**
 * Fully-resolved authorization envelope passed to every provider. Providers
 * NEVER receive raw identity strings — the plane resolves identity + governance
 * first, then providers make a capability-specific decision from this.
 */
export interface ContextAuth {
  tenantId: string;
  identity: ResolvedIdentity;
  authContext: AuthContext;
}

// ── Scope (ADR-002 §9) ──────────────────────────────────────────────────────

export interface ContextScope {
  tenantId: string;
  projectId?: string;
  customerId?: string;
  departmentId?: string;
  actorId?: string;
  /** Only assemble these capabilities. Empty/undefined = all registered. */
  includeCapabilities?: string[];
  excludeCapabilities?: string[];
  /** Client-side max age; older cached entries are refreshed. */
  maxContextAgeMs?: number;
  /** Optional time-range / record-limit hints for providers. */
  fromTime?: string;
  toTime?: string;
  recordLimit?: number;
}

// ── Provenance-bearing capability context (ADR-002 §10) ─────────────────────

export type ContextCacheStatus = 'FRESH' | 'CACHED' | 'UNAVAILABLE';

export interface CapabilityContext {
  capability: string;
  provider: string;
  authorization: ContextAuthorization;
  /**
   * Authorized data. Empty object when DENIED; partial (redacted) when
   * REDACTED; complete when FULL. Consumers MUST read `authorization.access`
   * — DENIED/UNAVAILABLE are NOT the same as "zero"/"none".
   */
  data: Record<string, unknown>;
  /** Source entity refs the data was derived from. */
  sourceEntities: Array<{ entityType: string; entityId: string }>;
  tenantId: string;
  scope: ContextScope;
  fetchedAt: string;
  lastModifiedAt: string | null;
  cacheStatus: ContextCacheStatus;
  expiresAt: string;
  /** true when the capability could not be reached / has no data surface. */
  unavailable?: boolean;
  unavailableReason?: string;
}

// ── Provider port (capability-owned) ────────────────────────────────────────

export const CONTEXT_PROVIDER = Symbol('CONTEXT_PROVIDER');

export interface IOrganizationalContextProvider {
  /** Stable capability name, e.g. 'projects', 'customers'. */
  readonly capability: string;

  /**
   * Return authorized context for this capability. MUST:
   *  - evaluate a capability-specific authorization decision (FULL/REDACTED/DENIED),
   *  - enforce tenant isolation,
   *  - never return another tenant's data,
   *  - never throw on empty — return an UNAVAILABLE/empty CapabilityContext.
   */
  getContext(auth: ContextAuth, scope: ContextScope): Promise<CapabilityContext>;
}

// ── Plane port (aggregation) ────────────────────────────────────────────────

export const CONTEXT_PLANE = Symbol('CONTEXT_PLANE');

export interface AssembleParams {
  tenantId: string;
  /** The organizational actor requesting context (Hermes agent id or user id). */
  actorId: string;
  actorType: EmployeeType;
  scope: Omit<ContextScope, 'tenantId'>;
}

export interface AssembledContext {
  tenantId: string;
  actorId: string;
  identity: ResolvedIdentity;
  authContext: AuthContext;
  capabilities: Record<string, CapabilityContext>;
  assembledAt: string;
}

export interface IOrganizationalContextPlane {
  registerProvider(provider: IOrganizationalContextProvider): void;
  listProviders(): string[];
  /**
   * Resolve identity → governance → per-capability authorization → aggregate.
   * Fails safe: missing identity/governance yields DENIED capability contexts,
   * never silent full access.
   */
  assemble(params: AssembleParams): Promise<AssembledContext>;
}
