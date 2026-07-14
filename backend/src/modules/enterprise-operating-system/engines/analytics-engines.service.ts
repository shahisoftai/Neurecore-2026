/**
 * Enterprise OS — Forecasting, Optimization, Analytics, Performance,
 * Resilience, Resource, Strategy engines (Phase 7).
 * ALL consume the Digital Twin snapshot (read-only). NONE execute or mutate
 * production state. Categorical confidence only.
 */

import { Inject, Injectable } from '@nestjs/common';
import { ENTERPRISE_COGNITION } from '../../enterprise-cognition/contracts/enterprise-cognition.interface';
import type { IEnterpriseCognition } from '../../enterprise-cognition/contracts/enterprise-cognition.interface';
import type {
  AnalyticsSnapshot,
  DigitalTwinSnapshot,
  EnterprisePerformanceIndex,
  ExecutiveSummary,
  Forecast,
  IForecastingEngine,
  IExecutiveAdvisor,
  IEnterpriseAnalytics,
  IEnterprisePerformance,
  IOptimizationEngine,
  IResilienceEngine,
  IResourceOptimizer,
  IStrategyMonitor,
  OptimizationRecommendation,
  ResilienceFinding,
  ResourceRecommendation,
  StrategyDrift,
} from '../contracts/enterprise-operating-system.interface';

@Injectable()
export class ForecastingEngine implements IForecastingEngine {
  async forecast(_tenantId: string, twin: DigitalTwinSnapshot): Promise<Forecast[]> {
    return [
      { subject: 'mission_success', trend: (twin.missions?.count ?? 0) < 2 ? 'STABLE' : 'IMPROVING', confidence: 'MEDIUM', evidence: [`${twin.missions?.count ?? 0} active missions`], prediction: 'Stable to improving.' },
      { subject: 'approval_demand', trend: (twin.approvals?.pendingCount ?? 0) >= 5 ? 'DECLINING' : 'STABLE', confidence: 'HIGH', evidence: [`${twin.approvals?.pendingCount ?? 0} pending approvals`], prediction: 'Monitor for bottlenecks.' },
    ];
  }
}

@Injectable()
export class OptimizationEngine implements IOptimizationEngine {
  async optimize(_tenantId: string, twin: DigitalTwinSnapshot): Promise<OptimizationRecommendation[]> {
    const out: OptimizationRecommendation[] = [];
    if ((twin.approvals?.pendingCount ?? 0) >= 5) out.push({ area: 'APPROVAL_FLOW', recommendation: 'Clear pending approvals', expectedGain: 'GOOD', confidence: 'HIGH', tradeoffs: [] });
    if (twin.projects?.count === 0) out.push({ area: 'RUNTIME_THROUGHPUT', recommendation: 'No active projects — initiate discovery', expectedGain: 'FAIR', confidence: 'MEDIUM', tradeoffs: [] });
    return out;
  }
}

@Injectable()
export class ExecutiveAdvisor implements IExecutiveAdvisor {
  constructor(@Inject(ENTERPRISE_COGNITION) private readonly cognition: IEnterpriseCognition) {}
  async summarize(tenantId: string, actorId: string, twin: DigitalTwinSnapshot): Promise<ExecutiveSummary> {
    const cog = await this.cognition.cognize({
      tenantId, actorId, actorType: 'AI_AGENT',
      request: `Executive briefing. Enterprise state: ${JSON.stringify(twin).slice(0, 6000)}. Identify strategic priorities, risks, opportunities, bottlenecks.`,
    }).catch(() => null);
    return {
      tenantId, generatedAt: new Date().toISOString(), enterprise: twin,
      strategicPriorities: cog?.recommendations?.map((r: any) => r.title) ?? [],
      topRisks: [], topOpportunities: [], recommendations: [],
      performance: { enterprise: twin.health?.enterprise ?? 'FAIR', missions: twin.health?.missions ?? 'FAIR', employees: 'GOOD' },
      bottlenecks: [], reasoning: cog?.objective?.reasoning?.conclusion ?? 'executive summary via cognition',
    };
  }
}

@Injectable()
export class EnterpriseAnalyticsService implements IEnterpriseAnalytics {
  async analyze(_tenantId: string, twin: DigitalTwinSnapshot): Promise<AnalyticsSnapshot[]> {
    return [
      { scope: 'ENTERPRISE', metrics: { activeMissions: twin.missions?.count ?? 0, projects: twin.projects?.count ?? 0, pendingApprovals: twin.approvals?.pendingCount ?? 0 }, trend: 'STABLE' },
    ];
  }
}

@Injectable()
export class EnterprisePerformanceService implements IEnterprisePerformance {
  async compute(_tenantId: string, twin: DigitalTwinSnapshot): Promise<EnterprisePerformanceIndex> {
    return { enterprise: twin.health?.enterprise ?? 'GOOD', missionSuccess: twin.health?.missions ?? 'GOOD', departmentPerformance: [], employeeEffectiveness: 'GOOD', recommendationQuality: 'GOOD', executionSuccess: 'GOOD', governanceHealth: twin.health?.governance ?? 'EXCELLENT', operationalEfficiency: 'GOOD' };
  }
}

@Injectable()
export class ResilienceEngine implements IResilienceEngine {
  async assess(_tenantId: string, twin: DigitalTwinSnapshot): Promise<ResilienceFinding[]> {
    const out: ResilienceFinding[] = [];
    if ((twin.approvals?.pendingCount ?? 0) >= 5) out.push({ kind: 'APPROVAL_BOTTLENECK', detail: `${twin.approvals?.pendingCount} pending approvals`, severity: 'HIGH', mitigation: 'Delegate review authority.' });
    if (twin.projects?.count === 0) out.push({ kind: 'RUNTIME_CONGESTION', detail: 'No active projects', severity: 'MEDIUM', mitigation: 'Initiate discovery.' });
    return out;
  }
}

@Injectable()
export class ResourceOptimizer implements IResourceOptimizer {
  async recommend(_tenantId: string, twin: DigitalTwinSnapshot): Promise<ResourceRecommendation[]> {
    if (twin.employees?.count === 0) return [{ area: 'CAPACITY_PLANNING', recommendation: 'No AI employees registered', urgency: 'FAIR', confidence: 'HIGH' }];
    return [];
  }
}

@Injectable()
export class StrategyMonitor implements IStrategyMonitor {
  async check(_tenantId: string, twin: DigitalTwinSnapshot): Promise<StrategyDrift> {
    const hasDrift = twin.riskLevel === 'HIGH' || twin.riskLevel === 'CRITICAL';
    return { currentStrategy: 'Mission-driven enterprise operations', driftDetected: hasDrift, deviation: hasDrift ? `Risk level ${twin.riskLevel}` : 'None', severity: hasDrift ? (twin.riskLevel as any) : 'LOW', recommendedCorrection: hasDrift ? 'Review priorities' : null };
  }
}
