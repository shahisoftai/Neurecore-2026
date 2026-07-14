import { Module } from '@nestjs/common';
import { EnterpriseCognitionModule } from '../enterprise-cognition/enterprise-cognition.module';
import { EnterpriseAutonomyModule } from '../enterprise-autonomy/enterprise-autonomy.module';
import { DIGITAL_TWIN, SCENARIO_ENGINE, SIMULATION_ENGINE, FORECASTING_ENGINE, OPTIMIZATION_ENGINE, EXECUTIVE_ADVISOR, ENTERPRISE_ANALYTICS, ENTERPRISE_PERFORMANCE, RESILIENCE_ENGINE, RESOURCE_OPTIMIZER, STRATEGY_MONITOR, ENTERPRISE_OS } from './contracts/enterprise-operating-system.interface';
import { DigitalTwin, ScenarioEngine, SimulationEngine } from './twin/digital-twin.service';
import { ForecastingEngine, OptimizationEngine, ExecutiveAdvisor, EnterpriseAnalyticsService, EnterprisePerformanceService, ResilienceEngine as Resilience, ResourceOptimizer, StrategyMonitor } from './engines/analytics-engines.service';
import { EnterpriseOperatingSystem } from './enterprise-operating-system.service';
import { EnterpriseOSController } from './enterprise-operating-system.controller';

@Module({
  imports: [EnterpriseCognitionModule, EnterpriseAutonomyModule],
  controllers: [EnterpriseOSController],
  providers: [
    DigitalTwin, { provide: DIGITAL_TWIN, useExisting: DigitalTwin },
    ScenarioEngine, { provide: SCENARIO_ENGINE, useExisting: ScenarioEngine },
    SimulationEngine, { provide: SIMULATION_ENGINE, useExisting: SimulationEngine },
    ForecastingEngine, { provide: FORECASTING_ENGINE, useExisting: ForecastingEngine },
    OptimizationEngine, { provide: OPTIMIZATION_ENGINE, useExisting: OptimizationEngine },
    ExecutiveAdvisor, { provide: EXECUTIVE_ADVISOR, useExisting: ExecutiveAdvisor },
    EnterpriseAnalyticsService, { provide: ENTERPRISE_ANALYTICS, useExisting: EnterpriseAnalyticsService },
    EnterprisePerformanceService, { provide: ENTERPRISE_PERFORMANCE, useExisting: EnterprisePerformanceService },
    Resilience, { provide: RESILIENCE_ENGINE, useExisting: Resilience },
    ResourceOptimizer, { provide: RESOURCE_OPTIMIZER, useExisting: ResourceOptimizer },
    StrategyMonitor, { provide: STRATEGY_MONITOR, useExisting: StrategyMonitor },
    EnterpriseOperatingSystem, { provide: ENTERPRISE_OS, useExisting: EnterpriseOperatingSystem },
  ],
})
export class EnterpriseOperatingSystemModule {}
