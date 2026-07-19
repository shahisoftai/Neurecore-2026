import { Module, forwardRef } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { DeploymentController } from './deployment.controller';
import { AgentInvocationsController } from './agent-invocations.controller';
import { AgentsService } from './services/agents.service';
import { AgentPlannerService } from './services/agent-planner.service';
import { AgentExecutorService } from './services/agent-executor.service';
import { AgentEvaluatorService } from './services/agent-evaluator.service';
import { AgentInvocationsService } from './services/agent-invocations.service';
import { DeploymentService } from './services/deployment.service';
import { EventsModule } from '../events/events.module';
import { ToolsModule } from '../tools/tools.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { GovernanceModule } from '../governance/governance.module';
import { ModelsModule } from '../models/models.module';
import { AgentStreamingService } from './streaming/agent-streaming.service';
import { AgentStreamingController } from './streaming/agent-streaming.controller';
import { AgentCheckpointService } from './langgraph/checkpoint.service';
import { SecurityModule } from './security/security.module';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { MetricsModule } from '../metrics/metrics.module';

/**
 * AgentsModule
 *
 * SOLID — OCP: new agent types/services added without modifying this module.
 * DIP: all providers injected via module system, not constructed directly.
 */
@Module({
  imports: [
    forwardRef(() => EventsModule),
    ToolsModule,
    forwardRef(() => IntegrationsModule),
    GovernanceModule,
    ModelsModule,
    SecurityModule,
    AIGatewayModule,
    MetricsModule,
  ],
  controllers: [
    AgentsController,
    DeploymentController,
    AgentStreamingController,
    AgentInvocationsController,
  ],
  providers: [
    AgentsService,
    AgentPlannerService,
    AgentExecutorService,
    AgentEvaluatorService,
    AgentInvocationsService,
    DeploymentService,
    AgentStreamingService,
    AgentCheckpointService,
  ],
  exports: [
    AgentsService,
    AgentPlannerService,
    AgentExecutorService,
    AgentEvaluatorService,
    AgentInvocationsService,
    DeploymentService,
    AgentStreamingService,
    AgentCheckpointService,
  ],
})
export class AgentsModule {}
