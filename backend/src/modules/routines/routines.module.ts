/**
 * Routines Module
 *
 * Paperclip Routines/Workflows integration with LangGraph.
 * Implements automated workflow execution with triggers and checkpointing.
 *
 * Stage 1 §4.7.3 — also consumes TenantTemplate ROUTINE configs for
 * description/channels when materialising routines from templates.
 */

import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Controllers
import { RoutinesController, WebhooksController } from './routines.controller';

// Services
import { RoutineExecutionService } from './services/routine-execution.service';
import { RoutinesTemplateService } from './services/routines-template.service';

// Repositories
import {
  PrismaRoutineRepository,
  PrismaRoutineTriggerRepository,
  PrismaRoutineRunRepository,
} from './repositories/prisma-routine.repository';

// LangGraph
import { RoutineGraph } from './langgraph/routine-graph';

// Dependencies
import { AgentsModule } from '../agents/agents.module';
import { ToolsModule } from '../tools/tools.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { TenantTemplatesModule } from '../tenant-templates/tenant-templates.module';

@Module({
  imports: [DatabaseModule, AgentsModule, ToolsModule, TenantTemplatesModule],
  controllers: [RoutinesController, WebhooksController],
  providers: [
    PrismaRoutineRepository,
    PrismaRoutineTriggerRepository,
    PrismaRoutineRunRepository,
    RoutineGraph,
    RoutineExecutionService,
    RoutinesTemplateService,
  ],
  exports: [
    PrismaRoutineRepository,
    PrismaRoutineTriggerRepository,
    PrismaRoutineRunRepository,
    RoutineExecutionService,
    RoutinesTemplateService,
  ],
})
export class RoutinesModule {}
