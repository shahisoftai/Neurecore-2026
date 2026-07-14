/**
 * Platform Operations — contracts (Phase 8).
 *
 * Enterprise production readiness: security, audit, compliance, disaster
 * recovery, backup, deployment, observability, telemetry, health, diagnostics,
 * performance, capacity, chaos, operational readiness. Stubs provided for
 * externally-dependent engines (DR, Backup, Deployment, Capacity, Chaos) that
 * require operational infrastructure — these expose the contract but delegate
 * to external systems.
 */

export type Grade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
export type Confidence = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ── Platform Health ────────────────────────────────────────────────────────
export interface PlatformHealth {
  overall: Grade;
  infrastructure: { database: Grade; redis: Grade; eventFabric: Grade; llmProvider: Grade };
  layers: { p1Eie: Grade; p2EventFabric: Grade; p3ContextPlane: Grade; p4WorkRuntime: Grade; p5Cognition: Grade; p6Autonomy: Grade; p7Eos: Grade };
  aiWorkforce: { employeeCount: number; availabilityRatio: number };
  computedAt: string;
  issues: string[];
}

// ── Audit ───────────────────────────────────────────────────────────────────
export interface AuditRecord {
  id: string;
  tenantId: string;
  traceId: string;
  correlationId: string;
  actorId: string | null;
  action: string;
  layer: string;
  resource: string;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED' | 'OVERRIDE';
  timestamp: string;
  metadata: Record<string, unknown>;
}
export interface AuditExport {
  generatedAt: string;
  tenantId: string;
  records: AuditRecord[];
  checksum: string;
  tamperEvident: boolean;
}

// ── Security ────────────────────────────────────────────────────────────────
export interface SecurityAssessment {
  overall: Grade;
  crossTenantIsolation: Grade;
  authAuthz: Grade;
  secretsHealth: Grade;
  injectionResistance: Grade;
  privilegeEscalationRisk: Severity;
  findings: { area: string; severity: Severity; detail: string }[];
}

// ── Observability / Tracing ─────────────────────────────────────────────────
export interface TraceContext {
  traceId: string;
  correlationId: string;
  tenantId: string;
  actorId: string;
  missionId?: string;
  workRunId?: string;
  simulationId?: string;
}

// ── Diagnostics ─────────────────────────────────────────────────────────────
export interface DiagnosticReport {
  overall: Grade;
  configValidation: { ok: boolean; issues: string[] };
  providerHealth: { provider: string; ok: boolean; latencyMs: number }[];
  resourceUsage: { cpu?: string; memory?: string; dbConnections?: number };
  eventDelivery: { ok: boolean; oldestPendingMs: number; deadLetteredCount: number };
  queueHealth: Grade;
  issues: string[];
}

// ── Operational Readiness ───────────────────────────────────────────────────
export interface OperationalReadinessReport {
  overall: Grade;
  modulesValidated: Record<string, boolean>; // module name → DI resolves
  deploymentHealth: { migrationStatus: string; healthCheckOk: boolean };
  backupStatus: Grade;
  drStatus: Grade;
  issues: string[];
}

// ── Deployment (stub — requires external CI/CD infrastructure) ──────────────
export interface DeploymentStatus {
  currentVersion: string;
  lastDeployedAt: string | null;
  healthGateOk: boolean;
  rollbackAvailable: boolean;
}

// ── Backup (stub) ───────────────────────────────────────────────────────────
export interface BackupVerification {
  ok: boolean;
  lastBackupAt: string | null;
  sizeBytes: number;
  checksum: string | null;
}

// ── Ports ───────────────────────────────────────────────────────────────────
export const PLATFORM_HEALTH = Symbol('PLATFORM_HEALTH');
export interface IHealthCenter {
  assess(): Promise<PlatformHealth>;
}

export const AUDIT_CENTER = Symbol('AUDIT_CENTER');
export interface IAuditCenter {
  exportAudit(tenantId: string): Promise<AuditExport>;
  list(tenantId: string, limit?: number): Promise<AuditRecord[]>;
}

export const SECURITY_CENTER = Symbol('SECURITY_CENTER');
export interface ISecurityCenter {
  assess(): Promise<SecurityAssessment>;
}

export const OBSERVABILITY_ENGINE = Symbol('OBSERVABILITY_ENGINE');
export interface IObservabilityEngine {
  /** Enrich a request context with trace/correlation ids. */
  enrich(current: Partial<TraceContext>): TraceContext;
}

export const DIAGNOSTICS_ENGINE = Symbol('DIAGNOSTICS_ENGINE');
export interface IDiagnosticsEngine {
  run(): Promise<DiagnosticReport>;
}

export const OPERATIONAL_READINESS = Symbol('OPERATIONAL_READINESS');
export interface IOperationalReadiness {
  validate(): Promise<OperationalReadinessReport>;
}

export const DEPLOYMENT_MANAGER = Symbol('DEPLOYMENT_MANAGER');
export interface IDeploymentManager {
  status(): Promise<DeploymentStatus>;
}

export const BACKUP_MANAGER = Symbol('BACKUP_MANAGER');
export interface IBackupManager {
  verify(): Promise<BackupVerification>;
}

export const PLATFORM_OPS = Symbol('PLATFORM_OPS');
export interface IPlatformOperations {
  health(): Promise<PlatformHealth>;
  audit(tenantId: string): Promise<AuditExport>;
  security(): Promise<SecurityAssessment>;
  diagnostics(): Promise<DiagnosticReport>;
  readiness(): Promise<OperationalReadinessReport>;
  deployment(): Promise<DeploymentStatus>;
  backup(): Promise<BackupVerification>;
}
