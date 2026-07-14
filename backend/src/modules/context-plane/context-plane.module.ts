/**
 * ContextPlaneModule — Organizational Context Plane (ADR-002, Phase 3).
 *
 * @Global so Hermes and future consumers can inject CONTEXT_PLANE without
 * import edges that risk cycles. Imports the capability modules whose PUBLIC
 * services the providers depend on (never their Prisma repositories). Providers
 * self-register with the plane on bootstrap.
 */

import { Global, Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { GovernanceModule } from '../governance/governance.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectStagesModule } from '../project-stages/project-stages.module';
import { ProjectMembersModule } from '../project-members/project-members.module';
import { InformationEngineModule } from '../information-engine/information-engine.module';
import { CustomersModule } from '../customers/customers.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { FinanceModule } from '../finance/finance.module';
import { ProjectMemoryModule } from '../project-memory/project-memory.module';
import { HermesModule } from '../hermes/hermes.module';

import { CONTEXT_PLANE } from './contracts/context-plane.interface';
import { OrganizationalContextPlane } from './plane/organizational-context-plane.service';
import { ContextIdentityResolver } from './resolvers/context-identity.resolver';
import { ContextCache } from './cache/context-cache.service';
import { ContextPlaneAdminController } from './context-plane-admin.controller';
import { ContextCacheInvalidationConsumer } from './consumers/context-cache-invalidation.consumer';
import { ProjectsContextProvider } from './providers/projects-context.provider';
import { CustomersContextProvider } from './providers/customers-context.provider';
import { TasksContextProvider } from './providers/tasks-context.provider';
import { FinanceContextProvider } from './providers/finance-context.provider';
import { ApprovalsContextProvider } from './providers/approvals-context.provider';
import { CommsContextProvider } from './providers/comms-context.provider';
import { MemoryContextProvider } from './providers/memory-context.provider';

@Global()
@Module({
  imports: [
    DatabaseModule,
    GovernanceModule,
    ProjectsModule,
    ProjectStagesModule,
    ProjectMembersModule,
    InformationEngineModule,
    CustomersModule,
    OrchestrationModule,
    FinanceModule,
    ProjectMemoryModule,
    forwardRef(() => HermesModule),
  ],
  controllers: [ContextPlaneAdminController],
  providers: [
    ContextCache,
    ContextIdentityResolver,
    OrganizationalContextPlane,
    { provide: CONTEXT_PLANE, useExisting: OrganizationalContextPlane },
    ContextCacheInvalidationConsumer,
    // Capability-owned providers (self-register on bootstrap).
    ProjectsContextProvider,
    CustomersContextProvider,
    TasksContextProvider,
    FinanceContextProvider,
    ApprovalsContextProvider,
    CommsContextProvider,
    MemoryContextProvider,
  ],
  exports: [CONTEXT_PLANE, OrganizationalContextPlane],
})
export class ContextPlaneModule {}
