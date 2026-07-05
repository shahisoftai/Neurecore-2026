import { Module, Global } from '@nestjs/common';
import { HermesRegistryService } from './services/hermes-registry.service';
import { ToolGatewayService } from './services/tool-gateway.service';
import { HermesSessionService } from './services/hermes-session.service';
import { HermesMemoryService } from './services/hermes-memory.service';
import { HermesContextService } from './services/hermes-context.service';
import { HermesEventBusService } from './services/hermes-event-bus.service';
import { HermesRuntimeService } from './services/hermes-runtime.service';
import { HermesNode } from './langgraph/hermes-node';
import { HermesRouter } from './langgraph/hermes-router';
import { HermesCheckpointer } from './langgraph/hermes-checkpointer';
import { HermesTenantGuard } from './guards/hermes-tenant.guard';
import { ApprovalWorkflowEngine } from './services/approval-workflow.engine';
import { ToolsModule } from '../tools/tools.module';
import { AgentsModule } from '../agents/agents.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Global()
@Module({
  imports: [ToolsModule, AgentsModule, KnowledgeModule, NotificationsModule],
  providers: [
    HermesRegistryService,
    ToolGatewayService,
    HermesSessionService,
    HermesMemoryService,
    HermesContextService,
    HermesEventBusService,
    HermesRuntimeService,
    HermesNode,
    HermesRouter,
    HermesCheckpointer,
    HermesTenantGuard,
    ApprovalWorkflowEngine,
  ],
  exports: [
    HermesRegistryService,
    ToolGatewayService,
    HermesSessionService,
    HermesMemoryService,
    HermesContextService,
    HermesEventBusService,
    HermesRuntimeService,
    HermesNode,
    HermesRouter,
    HermesCheckpointer,
    HermesTenantGuard,
    ApprovalWorkflowEngine,
  ],
})
export class HermesModule {}
