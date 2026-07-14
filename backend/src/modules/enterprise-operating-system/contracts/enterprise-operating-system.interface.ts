/**
 * Enterprise Operating System — contracts (Phase 7).
 *
 * Digital Twin (mirrors P3-P6 state, never owns data), Scenario/Simulation
 * engines (deterministic, read-only snapshots), Forecasting/Optimization
 * (recommend-only, categorical confidence), Executive Advisor (board-level,
 * explainable), Analytics/Performance/Resilience/Resource/Strategy monitors.
 * NEVER bypasses governance, runtime, or capability ownership.
 */

export type Grade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
export type Confidence = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ── Digital Twin (read-only mirror of enterprise state) ────────────────────
export interface DigitalTwinSnapshot {
  id: string;
  tenantId: string;
  timestamp: string;
  projects: { count: number; byStatus: Record<string, number> };
  employees: { count: number; availability: Record<string, number> };
  departments: { count: number };
  missions: { count: number; byStatus: Record<string, number> };
  approvals: { pendingCount: number };
  kpi: { scope: string; grade: Grade }[];
  health: { enterprise: Grade; missions: Grade; governance: Grade };
  riskLevel: Severity;
  contextAccess: Record<string, string>; // capability → access level
}

// ── Scenario (one "what if") ───────────────────────────────────────────────
export type ScenarioKind =
  | 'BUDGET_CUT'
  | 'DEPARTMENT_UNAVAILABLE'
  | 'CUSTOMER_LOST'
  | 'INFRASTRUCTURE_OUTAGE'
  | 'EMPLOYEE_OVERLOAD'
  | 'NEW_PROJECT_ARRIVAL'
  | 'APPROVAL_BACKLOG'
  | 'MARKET_EXPANSION'
  | 'REGULATORY_CHANGE'
  | 'CUSTOM';

export interface ScenarioDefinition {
  tenantId: string;
  kind: ScenarioKind;
  label: string;
  /** Param overrides for the simulation (e.g. { budgetCutPercent: 20, affectedDepartment: 'marketing' }). */
  params: Record<string, unknown>;
}

export interface ScenarioOutcome {
  scenario: ScenarioDefinition;
  predictedEffects: string[];
  risks: Severity[];
  bottlenecks: string[];
  recommendations: string[];
  alternativePlans: string[];
  confidence: Confidence;
  reasoning: string;
}

// ── Simulation (deterministic, read-only — never mutates production) ────────
export interface SimulationResult {
  id: string;
  scenarioId: string;
  tenantId: string;
  /** Snapshot of the twin BEFORE simulation (immutable reference). */
  baselineTwin: DigitalTwinSnapshot;
  /** Projected twin AFTER applying the scenario to the baseline. */
  projectedTwin: DigitalTwinSnapshot;
  outcomes: ScenarioOutcome;
  /** Simulation took this many ms (deterministic; must complete fast). */
  durationMs: number;
  createdAt: string;
}

// ── Forecasting (categorical confidence, trends only) ───────────────────────
export interface Forecast {
  subject: string; // 'workload' | 'budget' | 'project_completion' | 'mission_success' | 'approval_demand' | 'ai_utilization' | 'enterprise_health' | 'kpi_trends' | 'okr_completion'
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'CRITICAL';
  confidence: Confidence;
  evidence: string[];
  prediction: string;
}

// ── Optimization (recommend-only) ───────────────────────────────────────────
export interface OptimizationRecommendation {
  area: 'MISSION_ORDERING' | 'AI_ALLOCATION' | 'DEPARTMENT_UTILIZATION' | 'APPROVAL_FLOW' | 'RUNTIME_THROUGHPUT' | 'GOVERNANCE_EFFICIENCY';
  recommendation: string;
  expectedGain: Grade;
  confidence: Confidence;
  tradeoffs: string[];
}

// ── Executive Advisor (board-level, explainable) ────────────────────────────
export interface ExecutiveSummary {
  tenantId: string;
  generatedAt: string;
  enterprise: DigitalTwinSnapshot;
  strategicPriorities: string[];
  topRisks: { risk: string; severity: Severity }[];
  topOpportunities: { opportunity: string; importance: Grade }[];
  recommendations: OptimizationRecommendation[];
  performance: { enterprise: Grade; missions: Grade; employees: Grade };
  bottlenecks: string[];
  reasoning: string;
}

// ── Analytics ───────────────────────────────────────────────────────────────
export interface AnalyticsSnapshot {
  scope: 'ENTERPRISE' | 'DEPARTMENT' | 'MISSION' | 'EMPLOYEE' | 'RUNTIME' | 'GOVERNANCE';
  metrics: Record<string, string | number>;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

// ── Performance ─────────────────────────────────────────────────────────────
export interface EnterprisePerformanceIndex {
  enterprise: Grade;
  missionSuccess: Grade;
  departmentPerformance: { department: string; grade: Grade }[];
  employeeEffectiveness: Grade;
  recommendationQuality: Grade;
  executionSuccess: Grade;
  governanceHealth: Grade;
  operationalEfficiency: Grade;
}

// ── Resilience ──────────────────────────────────────────────────────────────
export interface ResilienceFinding {
  kind: 'SINGLE_POINT_OF_FAILURE' | 'APPROVAL_BOTTLENECK' | 'RESOURCE_CONCENTRATION' | 'CRITICAL_DEPENDENCY' | 'KNOWLEDGE_CONCENTRATION' | 'RUNTIME_CONGESTION';
  detail: string;
  severity: Severity;
  mitigation: string;
}

// ── Resource ────────────────────────────────────────────────────────────────
export interface ResourceRecommendation {
  area: 'DEPARTMENT_BALANCING' | 'MISSION_REDISTRIBUTION' | 'CAPACITY_PLANNING' | 'AI_UTILIZATION' | 'FUTURE_STAFFING' | 'RUNTIME_SCALING';
  recommendation: string;
  urgency: Grade;
  confidence: Confidence;
}

// ── Strategy ────────────────────────────────────────────────────────────────
export interface StrategyDrift {
  currentStrategy: string;
  driftDetected: boolean;
  deviation: string;
  severity: Severity;
  recommendedCorrection: string | null;
}

// ── Ports ───────────────────────────────────────────────────────────────────
export const DIGITAL_TWIN = Symbol('DIGITAL_TWIN');
export interface IDigitalTwin {
  snapshot(tenantId: string, actorId: string): Promise<DigitalTwinSnapshot>;
  /** How many ms ago the last snapshot was taken (freshness). */
  freshnessMs(tenantId: string): number;
}

export const SCENARIO_ENGINE = Symbol('SCENARIO_ENGINE');
export interface IScenarioEngine {
  evaluate(scenario: ScenarioDefinition, twin: DigitalTwinSnapshot): Promise<ScenarioOutcome>;
}

export const SIMULATION_ENGINE = Symbol('SIMULATION_ENGINE');
export interface ISimulationEngine {
  /** Run a scenario against the current twin snapshot. NEVER mutates production. */
  simulate(scenario: ScenarioDefinition, actorId: string): Promise<SimulationResult>;
}

export const FORECASTING_ENGINE = Symbol('FORECASTING_ENGINE');
export interface IForecastingEngine {
  forecast(tenantId: string, twin: DigitalTwinSnapshot): Promise<Forecast[]>;
}

export const OPTIMIZATION_ENGINE = Symbol('OPTIMIZATION_ENGINE');
export interface IOptimizationEngine {
  optimize(tenantId: string, twin: DigitalTwinSnapshot): Promise<OptimizationRecommendation[]>;
}

export const EXECUTIVE_ADVISOR = Symbol('EXECUTIVE_ADVISOR');
export interface IExecutiveAdvisor {
  summarize(tenantId: string, actorId: string, twin: DigitalTwinSnapshot): Promise<ExecutiveSummary>;
}

export const ENTERPRISE_ANALYTICS = Symbol('ENTERPRISE_ANALYTICS');
export interface IEnterpriseAnalytics {
  analyze(tenantId: string, twin: DigitalTwinSnapshot): Promise<AnalyticsSnapshot[]>;
}

export const ENTERPRISE_PERFORMANCE = Symbol('ENTERPRISE_PERFORMANCE');
export interface IEnterprisePerformance {
  compute(tenantId: string, twin: DigitalTwinSnapshot): Promise<EnterprisePerformanceIndex>;
}

export const RESILIENCE_ENGINE = Symbol('RESILIENCE_ENGINE');
export interface IResilienceEngine {
  assess(tenantId: string, twin: DigitalTwinSnapshot): Promise<ResilienceFinding[]>;
}

export const RESOURCE_OPTIMIZER = Symbol('RESOURCE_OPTIMIZER');
export interface IResourceOptimizer {
  recommend(tenantId: string, twin: DigitalTwinSnapshot): Promise<ResourceRecommendation[]>;
}

export const STRATEGY_MONITOR = Symbol('STRATEGY_MONITOR');
export interface IStrategyMonitor {
  check(tenantId: string, twin: DigitalTwinSnapshot): Promise<StrategyDrift>;
}

export const ENTERPRISE_OS = Symbol('ENTERPRISE_OS');
export interface IEnterpriseOperatingSystem {
  /** Full executive cockpit: twin + forecast + optimize + executive summary. */
  cockpit(tenantId: string, actorId: string): Promise<ExecutiveSummary>;
  /** Simulate a "what-if" scenario (never mutates production). */
  simulate(scenario: ScenarioDefinition, actorId: string): Promise<SimulationResult>;
  /** Run a scenario by kind with default params. */
  simulateQuick(tenantId: string, actorId: string, kind: ScenarioKind): Promise<SimulationResult>;
  /** Individual read-only views. */
  twin(tenantId: string, actorId: string): Promise<DigitalTwinSnapshot>;
  forecast(tenantId: string, actorId: string): Promise<Forecast[]>;
  optimize(tenantId: string, actorId: string): Promise<OptimizationRecommendation[]>;
  performance(tenantId: string, actorId: string): Promise<EnterprisePerformanceIndex>;
  resilience(tenantId: string, actorId: string): Promise<ResilienceFinding[]>;
  analytics(tenantId: string, actorId: string): Promise<AnalyticsSnapshot[]>;
  resource(tenantId: string, actorId: string): Promise<ResourceRecommendation[]>;
  strategy(tenantId: string, actorId: string): Promise<StrategyDrift>;
}
