/**
 * Cost Module - Interface Segregation
 *
 * Following SOLID principles:
 * - Single Responsibility: Each interface has ONE purpose
 * - Interface Segregation: Small, focused interfaces
 * - Dependency Inversion: Depend on abstractions, not concretions
 *
 * NOTE: Prisma types are imported dynamically in implementing classes
 * to avoid circular dependency issues with prisma generate timing.
 */

// ─── Cost Aggregation Provider ──────────────────────────────────────────────

/**
 * Interface for cost data aggregation from various sources (LangSmith, LLMFactory, etc.)
 * Single Responsibility: Only aggregates cost data
 *
 * NOTE: tenantId is read from TenantContextService internally by implementations.
 */
export interface ICostAggregationProvider {
  /**
   * Get aggregated cost summary for a tenant within a date range
   */
  getCostByTenant(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary>;

  /**
   * Get cost breakdown by specific agent
   */
  getCostByAgent(
    tenantId: string,
    agentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary>;

  /**
   * Get cost breakdown by LLM model
   */
  getCostByModel(
    tenantId: string,
    model: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary>;

  /**
   * Get cost breakdown by provider (OPENAI, ANTHROPIC, MINIMAX, etc.)
   */
  getCostByProvider(
    tenantId: string,
    provider: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary>;
}

/**
 * Cost summary aggregation result
 */
export interface CostSummary {
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  recordCount: number;
  byModel?: Record<string, number>;
  byProvider?: Record<string, number>;
  timeline?: CostTimelinePoint[];
}

/**
 * Cost data point for timeline charts
 */
export interface CostTimelinePoint {
  timestamp: Date;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
}

// ─── Cost Record Repository ─────────────────────────────────────────────────

/**
 * Interface for persisting and retrieving cost records
 * Single Responsibility: Only handles cost record CRUD
 *
 * NOTE: tenantId is read from TenantContextService internally by implementations.
 */
export interface ICostRecordRepository {
  /**
   * Save a new cost record
   */
  save(record: CreateCostRecordInput): Promise<unknown>;

  /**
   * Batch save multiple cost records
   */
  saveBatch(records: CreateCostRecordInput[]): Promise<unknown[]>;

  /**
   * Find cost records for a tenant within date range
   */
  findByTenant(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    options?: FindCostRecordsOptions,
  ): Promise<unknown[]>;

  /**
   * Find cost record by ID
   */
  findById(id: string): Promise<unknown | null>;

  /**
   * Get total cost for tenant in period
   */
  getTotalCost(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number>;

  /**
   * Get cost records grouped by agent
   * Phase 2 — optional `departmentId` filter
   */
  getCostByAgent(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    departmentId?: string,
  ): Promise<
    Array<{
      agentId: string;
      totalCostCents: number;
      recordCount: number;
      departmentId?: string | null;
    }>
  >;

  /**
   * Phase 2 — get cost summary aggregated for a single department.
   */
  getCostSummaryByDepartment(
    tenantId: string,
    departmentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalCostCents: number;
    recordCount: number;
    byAgent: Array<{
      agentId: string;
      totalCostCents: number;
      recordCount: number;
    }>;
  }>;

  /**
   * Get cost records grouped by model
   */
  getCostByModel(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<
    Array<{
      model: string;
      provider: string;
      totalCostCents: number;
      recordCount: number;
    }>
  >;
}

/**
 * Options for finding cost records
 */
export interface FindCostRecordsOptions {
  agentId?: string;
  provider?: string;
  model?: string;
  limit?: number;
  offset?: number;
}

/**
 * Input for creating a cost record
 */
export interface CreateCostRecordInput {
  tenantId: string;
  agentId?: string;
  departmentId?: string;
  runId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  windowStart: Date;
  windowEnd: Date;
}

// ─── Budget Policy Repository ───────────────────────────────────────────────

/**
 * Interface for budget policy CRUD operations
 * Single Responsibility: Only handles budget policy persistence
 *
 * NOTE: tenantId is read from TenantContextService internally by implementations.
 */
export interface IBudgetPolicyRepository {
  /**
   * Find all budget policies for a tenant
   */
  findByTenant(tenantId: string): Promise<unknown[]>;

  /**
   * Find budget policies by scope (e.g., all for an agent)
   */
  findByScope(
    tenantId: string,
    scope: 'TENANT' | 'DEPARTMENT' | 'AGENT' | 'MODEL' | 'PROJECT',
    scopeId?: string,
  ): Promise<unknown[]>;

  /**
   * Find a budget policy by projectId (Phase 8)
   */
  findByProject(projectId: string): Promise<unknown | null>;

  /**
   * Find active budget policies that need checking
   */
  findActivePolicies(tenantId: string): Promise<unknown[]>;

  /**
   * Create a new budget policy
   */
  create(input: CreateBudgetPolicyInput): Promise<unknown>;

  /**
   * Update an existing budget policy
   */
  update(id: string, input: UpdateBudgetPolicyInput): Promise<unknown>;

  /**
   * Update current spend for a policy
   */
  updateSpend(id: string, currentSpendCents: number): Promise<void>;

  /**
   * Delete a budget policy
   */
  delete(id: string): Promise<void>;
}

/**
 * Input for creating a budget policy
 */
export interface CreateBudgetPolicyInput {
  tenantId: string;
  name: string;
  limitCents: number;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  scope: 'TENANT' | 'DEPARTMENT' | 'AGENT' | 'MODEL' | 'PROJECT';
  scopeId?: string;
  projectId?: string; // Required when scope is PROJECT
  alertThresholds?: number[];
  action?: 'ALERT' | 'BLOCK' | 'DEGRADE';
  enabled?: boolean;
}

/**
 * Input for updating a budget policy
 */
export interface UpdateBudgetPolicyInput {
  name?: string;
  limitCents?: number;
  alertThresholds?: number[];
  action?: 'ALERT' | 'BLOCK' | 'DEGRADE';
  enabled?: boolean;
}

// ─── Budget Incident Repository ─────────────────────────────────────────────

/**
 * Interface for budget incident persistence
 * Single Responsibility: Only handles incident records
 */
export interface IBudgetIncidentRepository {
  /**
   * Create a new budget incident
   */
  create(input: CreateBudgetIncidentInput): Promise<unknown>;

  /**
   * Find incidents by budget policy
   */
  findByPolicy(policyId: string): Promise<unknown[]>;

  /**
   * Find active incidents for a tenant
   */
  findActiveByTenant(tenantId: string): Promise<unknown[]>;

  /**
   * Acknowledge an incident
   */
  acknowledge(id: string): Promise<void>;

  /**
   * Resolve an incident
   */
  resolve(id: string): Promise<void>;
}

/**
 * Input for creating a budget incident
 */
export interface CreateBudgetIncidentInput {
  budgetPolicyId: string;
  threshold: number;
  totalCents: number;
}
