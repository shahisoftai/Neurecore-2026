/**
 * Enterprise Autonomous Operations — contracts (Phase 6).
 *
 * GOVERNED autonomy: AI Employees + Departments + Missions that observe, reason,
 * coordinate, supervise, and INITIATE work. Every business mutation flows through
 * the Phase 4 Work Runtime. Autonomy is bounded by governance, authority,
 * approvals, policy, audit, and human oversight. No direct capability access,
 * no autonomous approvals/governance, no self-modification.
 */

export type Grade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
export type Confidence = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MissionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export type MissionStatus =
  | 'CREATED' | 'PLANNED' | 'ASSIGNED' | 'RUNNING' | 'WAITING'
  | 'ESCALATED' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

// ── AI Employee / Department ────────────────────────────────────────────────
export interface AiEmployeeView {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  departmentId: string | null;
  supervisorEmployeeId: string | null;
  authorityCeiling: number;
  allowedTools: string[];
  knowledgeDomains: string[];
  responsibilities: string[];
  currentWorkload: number;
  availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  healthStatus: Grade;
}
export interface CreateEmployeeInput {
  tenantId: string;
  name: string;
  role: string;
  departmentId?: string | null;
  supervisorEmployeeId?: string | null;
  authorityCeiling?: number;
  allowedTools?: string[];
  knowledgeDomains?: string[];
  responsibilities?: string[];
}
export interface AiDepartmentView {
  id: string;
  tenantId: string;
  name: string;
  supervisorEmployeeId: string | null;
  employeeCount: number;
}

// ── Mission ─────────────────────────────────────────────────────────────────
export interface MissionView {
  id: string;
  tenantId: string;
  title: string;
  objective: string;
  status: MissionStatus;
  priority: MissionPriority;
  assignedEmployeeId: string | null;
  departmentId: string | null;
  workRunIds: string[];
  escalationLevel: number;
  failureReason: string | null;
  createdAt: string;
}
export interface CreateMissionInput {
  tenantId: string;
  createdById: string;
  title: string;
  objective: string;
  description?: string;
  priority?: MissionPriority;
  departmentId?: string | null;
  scope?: { projectId?: string; customerId?: string };
}

// ── Observation (watchers produce; never execute) ───────────────────────────
export interface Observation {
  id?: string;
  tenantId: string;
  watcher: string;
  observation: string;
  evidence: Array<{ source: string; reference: string; detail: string }>;
  severity: Severity;
  confidence: Confidence;
  affectedDepartments: string[];
  affectedProjects: string[];
  recommendedAction: string | null;
  requiresRuntime: boolean;
  requiresApproval: boolean;
}

// ── KPI / OKR ───────────────────────────────────────────────────────────────
export interface KpiSnapshot {
  scope: 'ENTERPRISE' | 'DEPARTMENT' | 'EMPLOYEE' | 'PROJECT' | 'RUNTIME';
  metrics: Record<string, number | string>;
  grade: Grade;
}
export interface OkrProgress {
  objective: string;
  progress: Grade;
  risk: Severity;
  deviation: string;
}

// ── Escalation ──────────────────────────────────────────────────────────────
export type EscalationLevel = 'EMPLOYEE' | 'SUPERVISOR' | 'DEPARTMENT_HEAD' | 'EXECUTIVE_AI' | 'HUMAN';
export interface EscalationDecision {
  from: EscalationLevel;
  to: EscalationLevel;
  reason: string;
  requiresHuman: boolean;
}

// ── Enterprise health ───────────────────────────────────────────────────────
export interface EnterpriseHealth {
  enterprise: Grade;
  departments: Grade;
  missions: Grade;
  employees: Grade;
  execution: Grade;
  governance: Grade;
  recommendationQuality: Grade;
  riskLevel: Severity;
  computedAt: string;
  evidence: Array<{ metric: string; value: string }>;
}

// ── Autonomy policy + governor decision ─────────────────────────────────────
export interface AutonomyPolicy {
  maxConcurrentMissions: number;
  maxEmployeeWorkload: number;
  maxEscalationDepth: number;
  approvalTimeoutMs: number;
  missionTimeoutMs: number;
}
export type GovernorOutcome = 'ALLOW' | 'DENY' | 'REQUIRE_HUMAN';
export interface GovernorDecision {
  outcome: GovernorOutcome;
  reason: string;
  policySource: string;
  decidedAt: string;
}

// ── Ports ───────────────────────────────────────────────────────────────────
export const AI_EMPLOYEE_MANAGER = Symbol('AI_EMPLOYEE_MANAGER');
export interface IAIEmployeeManager {
  create(input: CreateEmployeeInput): Promise<AiEmployeeView>;
  get(id: string, tenantId: string): Promise<AiEmployeeView | null>;
  list(tenantId: string, departmentId?: string): Promise<AiEmployeeView[]>;
  adjustWorkload(id: string, tenantId: string, delta: number): Promise<void>;
}

export const AI_DEPARTMENT_MANAGER = Symbol('AI_DEPARTMENT_MANAGER');
export interface IAIDepartmentManager {
  create(tenantId: string, name: string, supervisorEmployeeId?: string): Promise<AiDepartmentView>;
  list(tenantId: string): Promise<AiDepartmentView[]>;
}

export const MISSION_PLANNER = Symbol('MISSION_PLANNER');
export interface IMissionPlanner {
  /** Plan a mission via Cognition (reasoning only; produces objective + intended work). */
  plan(mission: MissionView, actorId: string): Promise<{ planJson: Record<string, unknown>; recommendedWork: string[] }>;
}

export const MISSION_SCHEDULER = Symbol('MISSION_SCHEDULER');
export interface IMissionScheduler {
  /** Turn a planned mission's recommended work into governed Work Runs (Phase 4). */
  schedule(mission: MissionView, recommendedWork: string[], actorId: string): Promise<string[]>; // returns runIds
}

export const AUTONOMOUS_WATCHER = Symbol('AUTONOMOUS_WATCHER');
export interface IAutonomousWatcher {
  readonly name: string;
  /** Observe (never execute). Returns observations grounded in Context Plane. */
  observe(tenantId: string, actorId: string, scope?: { projectId?: string }): Promise<Observation[]>;
}

export const KPI_MONITOR = Symbol('KPI_MONITOR');
export interface IKpiMonitor {
  snapshot(tenantId: string, actorId: string): Promise<KpiSnapshot[]>;
}

export const OKR_MONITOR = Symbol('OKR_MONITOR');
export interface IOkrMonitor {
  progress(tenantId: string, actorId: string): Promise<OkrProgress[]>;
}

export const WORKLOAD_BALANCER = Symbol('WORKLOAD_BALANCER');
export interface IWorkloadBalancer {
  /** Recommend reassignments only; never force execution. */
  recommend(tenantId: string): Promise<Array<{ employeeId: string; utilization: Grade; recommendation: string }>>;
}

export const AUTONOMOUS_SUPERVISOR = Symbol('AUTONOMOUS_SUPERVISOR');
export interface IAutonomousSupervisor {
  /** Review a mission; may recommend escalation. Never bypasses governance. */
  review(mission: MissionView, observations: Observation[]): Promise<{ decision: string; escalate: boolean; reason: string }>;
}

export const AUTONOMY_POLICY_ENGINE = Symbol('AUTONOMY_POLICY_ENGINE');
export interface IAutonomyPolicyEngine {
  policy(tenantId: string): AutonomyPolicy;
}

export const AUTONOMY_GOVERNOR = Symbol('AUTONOMY_GOVERNOR');
export interface IAutonomyGovernor {
  /** Gate an autonomous action against policy + governance. Fail-safe DENY/REQUIRE_HUMAN. */
  authorize(params: {
    tenantId: string;
    action: 'CREATE_MISSION' | 'SCHEDULE_WORK' | 'ASSIGN_EMPLOYEE' | 'ESCALATE';
    concurrentMissions: number;
    employeeWorkload?: number;
    escalationDepth?: number;
  }): Promise<GovernorDecision>;
}

export const ENTERPRISE_HEALTH = Symbol('ENTERPRISE_HEALTH');
export interface IEnterpriseHealthService {
  compute(tenantId: string, actorId: string): Promise<EnterpriseHealth>;
}

export const ENTERPRISE_AUTONOMY = Symbol('ENTERPRISE_AUTONOMY');
export interface CreateAndRunMissionParams extends CreateMissionInput {
  /** If true, planned work is scheduled to the governed Work Runtime. Default false. */
  autoSchedule?: boolean;
}
export interface MissionResult {
  mission: MissionView;
  observations: Observation[];
  scheduledRunIds: string[];
  escalation: EscalationDecision | null;
}
export interface IEnterpriseAutonomy {
  createMission(params: CreateAndRunMissionParams): Promise<MissionResult>;
  runObservationCycle(tenantId: string, actorId: string, scope?: { projectId?: string }): Promise<Observation[]>;
  // ── Human oversight (final authority) ──
  humanOverride(missionId: string, tenantId: string, actorId: string, action: 'PAUSE' | 'CANCEL' | 'PRIORITIZE', detail?: string): Promise<MissionView>;
  getMission(missionId: string, tenantId: string): Promise<MissionView | null>;
  listMissions(tenantId: string): Promise<MissionView[]>;
}
