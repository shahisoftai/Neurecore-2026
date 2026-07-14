/**
 * Enterprise Operating System — top-level orchestrator (Phase 7).
 * Delegates to digital twin, scenario/simulation, forecasting, optimization,
 * executive advisor, analytics, performance, resilience, resource, strategy.
 * Publishes events; never executes capabilities. Consumes P3-P6 ports only.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EVENT_TRANSPORT } from '../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../enterprise-events/contracts/enterprise-event-transport.interface';
import { DIGITAL_TWIN, SIMULATION_ENGINE, FORECASTING_ENGINE, OPTIMIZATION_ENGINE, EXECUTIVE_ADVISOR, ENTERPRISE_ANALYTICS, ENTERPRISE_PERFORMANCE, RESILIENCE_ENGINE, RESOURCE_OPTIMIZER, STRATEGY_MONITOR } from './contracts/enterprise-operating-system.interface';
import type {
  AnalyticsSnapshot, DigitalTwinSnapshot, EnterprisePerformanceIndex, ExecutiveSummary, Forecast, IEnterpriseOperatingSystem, IDigitalTwin, IExecutiveAdvisor, IEnterpriseAnalytics, IEnterprisePerformance, IForecastingEngine, IOptimizationEngine, IResilienceEngine, IResourceOptimizer, ISimulationEngine, IStrategyMonitor,
  OptimizationRecommendation, ResilienceFinding, ResourceRecommendation, ScenarioDefinition, ScenarioKind, SimulationResult, StrategyDrift,
} from './contracts/enterprise-operating-system.interface';

const DEFAULT_PARAMS: Record<ScenarioKind, Record<string, unknown>> = {
  BUDGET_CUT: { budgetCutPercent: 20 },
  DEPARTMENT_UNAVAILABLE: { affectedDepartment: 'operations' },
  CUSTOMER_LOST: {},
  INFRASTRUCTURE_OUTAGE: {},
  EMPLOYEE_OVERLOAD: {},
  NEW_PROJECT_ARRIVAL: {},
  APPROVAL_BACKLOG: {},
  MARKET_EXPANSION: {},
  REGULATORY_CHANGE: {},
  CUSTOM: {},
};

@Injectable()
export class EnterpriseOperatingSystem implements IEnterpriseOperatingSystem {
  private readonly l = new Logger(EnterpriseOperatingSystem.name);
  constructor(
    @Inject(DIGITAL_TWIN) private readonly twinService: IDigitalTwin,
    @Inject(SIMULATION_ENGINE) private readonly simService: ISimulationEngine,
    @Inject(FORECASTING_ENGINE) private readonly forecastEng: IForecastingEngine,
    @Inject(OPTIMIZATION_ENGINE) private readonly optEng: IOptimizationEngine,
    @Inject(EXECUTIVE_ADVISOR) private readonly advisor: IExecutiveAdvisor,
    @Inject(ENTERPRISE_ANALYTICS) private readonly analyticsEng: IEnterpriseAnalytics,
    @Inject(ENTERPRISE_PERFORMANCE) private readonly perfEng: IEnterprisePerformance,
    @Inject(RESILIENCE_ENGINE) private readonly resilienceService: IResilienceEngine,
    @Inject(RESOURCE_OPTIMIZER) private readonly resourceService: IResourceOptimizer,
    @Inject(STRATEGY_MONITOR) private readonly strategyService: IStrategyMonitor,
    @Inject(EVENT_TRANSPORT) private readonly transport: IEnterpriseEventTransport,
  ) {}

  async cockpit(tenantId: string, actorId: string): Promise<ExecutiveSummary> {
    const t = await this.twinService.snapshot(tenantId, actorId);
    await this.publish('enterprise.digital_twin.updated', tenantId, { snapshotId: t.id });
    const summary = await this.advisor.summarize(tenantId, actorId, t);
    await this.publish('enterprise.executive.summary.generated', tenantId, {});
    return summary;
  }
  async simulate(scenario: ScenarioDefinition, actorId: string): Promise<SimulationResult> {
    const r = await this.simService.simulate(scenario, actorId);
    await this.publish('enterprise.simulation.completed', scenario.tenantId, { scenarioId: r.scenarioId });
    return r;
  }
  async simulateQuick(tenantId: string, actorId: string, kind: ScenarioKind): Promise<SimulationResult> {
    return this.simulate({ tenantId, kind, label: `Quick scenario: ${kind}`, params: DEFAULT_PARAMS[kind] ?? {} }, actorId);
  }

  async twin(tenantId: string, actorId: string): Promise<DigitalTwinSnapshot> { return this.twinService.snapshot(tenantId, actorId); }
  async forecast(tenantId: string, actorId: string): Promise<Forecast[]> {
    const t = await this.twinService.snapshot(tenantId, actorId); return this.forecastEng.forecast(tenantId, t);
  }
  async optimize(tenantId: string, actorId: string): Promise<OptimizationRecommendation[]> {
    const t = await this.twinService.snapshot(tenantId, actorId); return this.optEng.optimize(tenantId, t);
  }
  async performance(tenantId: string, actorId: string): Promise<EnterprisePerformanceIndex> {
    const t = await this.twinService.snapshot(tenantId, actorId); return this.perfEng.compute(tenantId, t);
  }
  async resilience(tenantId: string, actorId: string): Promise<ResilienceFinding[]> {
    const t = await this.twinService.snapshot(tenantId, actorId); return this.resilienceService.assess(tenantId, t);
  }
  async analytics(tenantId: string, actorId: string): Promise<AnalyticsSnapshot[]> {
    const t = await this.twinService.snapshot(tenantId, actorId); return this.analyticsEng.analyze(tenantId, t);
  }
  async resource(tenantId: string, actorId: string): Promise<ResourceRecommendation[]> {
    const t = await this.twinService.snapshot(tenantId, actorId); return this.resourceService.recommend(tenantId, t);
  }
  async strategy(tenantId: string, actorId: string): Promise<StrategyDrift> {
    const t = await this.twinService.snapshot(tenantId, actorId); return this.strategyService.check(tenantId, t);
  }

  private async publish(eventType: string, tenantId: string, payload: Record<string, unknown>): Promise<void> {
    try { await this.transport.publish({ eventType, tenantId, actorType: 'SYSTEM', idempotencyKey: `${eventType}:${payload.snapshotId ?? payload.scenarioId ?? randomUUID()}:${Date.now()}`, sourceModule: 'enterprise-operating-system', payload }); } catch (e) { this.l.warn(`Publish ${eventType}: ${e instanceof Error ? e.message : e}`); }
  }
}
