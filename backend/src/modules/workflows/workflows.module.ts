/**
 * WorkflowsModule — NestJS module wiring.
 *
 * Stage 2 Phase 2D: Exposes IndustryWorkflowTemplatesService for
 * per-industry workflow automation templates.
 *
 * SOLID:
 *   - Single Responsibility: only wires workflow-related dependencies
 *   - Dependency Inversion: uses EventsModule (not EventsGateway directly)
 */

import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './services/workflows.service';
import { IndustryWorkflowTemplatesService } from './industry-workflow-templates.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, IndustryWorkflowTemplatesService],
  exports: [WorkflowsService, IndustryWorkflowTemplatesService],
})
export class WorkflowsModule {}
