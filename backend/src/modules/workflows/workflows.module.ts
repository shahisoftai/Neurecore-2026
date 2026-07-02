/**
 * WorkflowsModule — NestJS module wiring.
 *
 * SOLID:
 *   - Single Responsibility: only wires workflow-related dependencies
 *   - Dependency Inversion: uses EventsModule (not EventsGateway directly)
 */

import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './services/workflows.service';
import { EventsModule } from '../events/events.module';

@Module({
    imports: [EventsModule],
    controllers: [WorkflowsController],
    providers: [WorkflowsService],
    exports: [WorkflowsService],
})
export class WorkflowsModule { }
