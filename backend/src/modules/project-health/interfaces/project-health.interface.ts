/**
 * project-health module — Interface Definitions
 *
 * Phase 6: Health Score + BI Dashboards
 * Multi-signal composite health scoring for projects.
 *
 * SOLID: Interface Segregation, Dependency Inversion.
 */

import type { HealthSeverity, HealthTrend } from '@prisma/client';

export type HealthSignalName =
  | 'budgetBurn'
  | 'timeline'
  | 'activityRate'
  | 'approvalDelay'
  | 'reworkRate';

export interface HealthSignal {
  name: HealthSignalName;
  value: number;       // 0-100 score (100 = perfect)
  weight: number;      // contribution to composite (weights sum to 1.0)
  label: string;
  detail?: string;     // human-readable explanation
}

export interface ProjectHealth {
  projectId: string;
  tenantId: string;
  overallScore: number;       // 0-100 composite
  severity: HealthSeverity;    // HEALTHY | WARNING | CRITICAL
  trend: HealthTrend;          // IMPROVING | STABLE | DEGRADING
  signals: HealthSignal[];
  atRiskReasons: string[];     // human-readable reasons for low score
  computedAt: Date;
}

export interface ComputeHealthInput {
  projectId: string;
  tenantId: string;
  /** Override weights; defaults to standard weights */
  weights?: Partial<Record<HealthSignalName, number>>;
}

export interface AnalyticsRollup {
  tenantId: string;
  period: '30d' | '90d' | '1y' | 'all';
  marginByCustomer: CustomerMargin[];
  marginByIndustry: IndustryMargin[];
  winRate: number;         // 0-1 fraction
  winRateTrend: HealthTrend;
  avgCycleTimeDays: number;
  cycleTimeTrend: HealthTrend;
  activeProjects: number;
  atRiskProjects: number;
  completedProjects: number;
  computedAt: Date;
}

export interface CustomerMargin {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  totalCost: number;
  margin: number;         // revenue - cost
  marginPercent: number;   // (margin / revenue) * 100
  projectCount: number;
}

export interface IndustryMargin {
  industry: string;
  totalRevenue: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
  projectCount: number;
}

export interface Bottleneck {
  entityType: 'STAGE' | 'APPROVER_ROLE';
  entityId: string;
  entityLabel: string;
  avgWaitHours: number;
  projectCount: number;
  trend: 'worsening' | 'stable' | 'improving';
}

export interface IProjectHealthRepository {
  upsertHealth(health: Omit<ProjectHealth, 'computedAt'>): Promise<void>;
  getHealth(projectId: string, tenantId: string): Promise<ProjectHealth | null>;
  getAtRiskProjects(tenantId: string, threshold?: number): Promise<ProjectHealth[]>;
  getHealthHistory(projectId: string, limit?: number): Promise<ProjectHealth[]>;
}


