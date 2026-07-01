import { Module } from '@nestjs/common';
import { EntitiesController } from './entities.controller';
import { EntityResolverService } from './services/entity-resolver.service';
import { EntityGraphService } from './services/entity-graph.service';
import { IdentityCapability } from './services/identity.capability';
import { ContextCapability } from './services/context.capability';
import { IntelligenceCapability } from './services/intelligence.capability';
import { OperationsCapability } from './services/operations.capability';
import { ResourcesCapability } from './services/resources.capability';
import { CollaborationCapability } from './services/collaboration.capability';
import { InsightsCapability } from './services/insights.capability';
import { AutomationCapability } from './services/automation.capability';
import { ActivityCapability } from './services/activity.capability';
import { LifecycleCapability } from './services/lifecycle.capability';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [EntitiesController],
  providers: [
    EntityResolverService,
    EntityGraphService,
    IdentityCapability,
    ContextCapability,
    IntelligenceCapability,
    OperationsCapability,
    ResourcesCapability,
    CollaborationCapability,
    InsightsCapability,
    AutomationCapability,
    ActivityCapability,
    LifecycleCapability,
  ],
  exports: [
    EntityResolverService,
    EntityGraphService,
    LifecycleCapability,
  ],
})
export class EntitiesModule {}
