import { Module, forwardRef } from '@nestjs/common';
import { HermesRegistryService } from './services/hermes-registry.service';
import { HermesSessionService } from './services/hermes-session.service';
import { ToolGatewayService } from './services/tool-gateway.service';
import { PermissionMatrixService } from './services/permission-matrix.service';
import { HermesRuntimeService } from './services/hermes-runtime.service';
import { HermesMemoryService } from './services/hermes-memory.service';
import { HermesContextService } from './services/hermes-context.service';
import { HermesEventBusService } from './services/hermes-event-bus.service';
import { HermesRouterService } from './services/hermes-router.service';
import { HermesRouterNode } from './langgraph/hermes-router';
import { ApprovalWorkflowEngine } from './services/approval-workflow.engine';
import { HermesTenantGuard } from './guards/hermes-tenant.guard';
import { FinanceHermesAgentFactory } from './agents/finance-hermes-agent';
import { HRHermesAgentFactory } from './agents/hr-hermes-agent';
import { SalesHermesAgentFactory } from './agents/sales-hermes-agent';
import { MarketingHermesAgentFactory } from './agents/marketing-hermes-agent';
import { HermesApprovalsController } from './controllers/hermes-approvals.controller';
import { HermesRegistryController } from './controllers/hermes-registry.controller';
import { HermesSessionsController } from './controllers/hermes-sessions.controller';
import { HermesDebugController } from './controllers/hermes-debug.controller';
import { HermesCheckpointer } from './langgraph/hermes-checkpointer';
import { ToolsModule } from '../tools/tools.module';
import { AgentsModule } from '../agents/agents.module';
import { GovernanceModule } from '../governance/governance.module';
import { SecurityModule } from '../agents/security/security.module';
import { AuditModule } from '../audit/audit.module';
import { ModelsModule } from '../models/models.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';

/**
 * HermesModule — AI Workforce Orchestration Layer
 *
 * SOLID:
 *  - OCP: New Hermes types added via HermesAgentType enum, no module changes
 *  - DIP: All providers injected via module system, never constructed directly
 *  - SRP: Each service has one responsibility
 *
 * Module structure:
 *  HermesRegistryService  → Agent capability registry
 *  HermesSessionService   → Conversation session lifecycle
 *  ToolGatewayService    → Tool permission enforcement
 *  PermissionMatrixService → Role × Agent × Tool matrix
 *  HermesTenantGuard      → Tenant isolation enforcement
 */
@Module({
  imports: [
    forwardRef(() => ToolsModule),
    forwardRef(() => AgentsModule),
    GovernanceModule,
    SecurityModule,
    AuditModule,
    ModelsModule,
    NotificationsModule,
    EventsModule,
  ],
  controllers: [HermesApprovalsController, HermesRegistryController, HermesSessionsController, HermesDebugController],
  providers: [
    HermesRegistryService,
    HermesSessionService,
    ToolGatewayService,
    PermissionMatrixService,
    HermesRuntimeService,
    HermesMemoryService,
    HermesContextService,
    HermesEventBusService,
    HermesRouterService,
    HermesRouterNode,
    HermesCheckpointer,
    ApprovalWorkflowEngine,
    HermesTenantGuard,
    FinanceHermesAgentFactory,
    HRHermesAgentFactory,
    SalesHermesAgentFactory,
    MarketingHermesAgentFactory,
  ],
  exports: [
    HermesRegistryService,
    HermesSessionService,
    ToolGatewayService,
    PermissionMatrixService,
    HermesRuntimeService,
    HermesMemoryService,
    HermesContextService,
    HermesEventBusService,
    HermesRouterService,
    HermesRouterNode,
    HermesCheckpointer,
    ApprovalWorkflowEngine,
    HermesTenantGuard,
    FinanceHermesAgentFactory,
    HRHermesAgentFactory,
    SalesHermesAgentFactory,
    MarketingHermesAgentFactory,
  ],
})
export class HermesModule { }
