import { Module } from '@nestjs/common';
import { HermesRegistryController } from './controllers/hermes-registry.controller';
import { HermesSessionsController } from './controllers/hermes-sessions.controller';
import { HermesDebugController } from './controllers/hermes-debug.controller';
import { HermesRegistryService } from './services/hermes-registry.service';
import { HermesRuntimeService } from './services/hermes-runtime.service';
import { HermesSessionService } from './services/hermes-session.service';
import { HermesMemoryService } from './services/hermes-memory.service';
import { HermesContextService } from './services/hermes-context.service';
import { HermesEventBusService } from './services/hermes-event-bus.service';
import { ToolGatewayService } from './services/tool-gateway.service';
import { PermissionMatrixService } from './services/permission-matrix.service';
import { ApprovalWorkflowEngine } from './services/approval-workflow.engine';
import { HermesCheckpointer } from './langgraph/hermes-checkpointer';
import { HermesRouter } from './langgraph/hermes-router';
import { HermesTenantGuard } from './guards/hermes-tenant.guard';
import { ToolsModule } from '../tools/tools.module';
import { GovernanceModule } from '../governance/governance.module';
import { EventsModule } from '../events/events.module';
import { ModelsModule } from '../models/models.module';
import { MemoryModule } from '../memory/memory.module';
import { FeatureFlagModule } from '../../common/feature-flag/feature-flag.module';

@Module({
  imports: [
    ToolsModule,
    GovernanceModule,
    EventsModule,
    ModelsModule,
    MemoryModule,
    FeatureFlagModule,
  ],
  controllers: [
    HermesRegistryController,
    HermesSessionsController,
    HermesDebugController,
  ],
  providers: [
    HermesRegistryService,
    HermesRuntimeService,
    HermesSessionService,
    HermesMemoryService,
    HermesContextService,
    HermesEventBusService,
    ToolGatewayService,
    PermissionMatrixService,
    ApprovalWorkflowEngine,
    HermesCheckpointer,
    HermesRouter,
    HermesTenantGuard,
  ],
  exports: [
    HermesRegistryService,
    HermesRuntimeService,
    HermesSessionService,
    HermesMemoryService,
    HermesContextService,
    HermesEventBusService,
    ToolGatewayService,
    PermissionMatrixService,
    ApprovalWorkflowEngine,
    HermesCheckpointer,
    HermesRouter,
  ],
})
export class HermesModule {}
