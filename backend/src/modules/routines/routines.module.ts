/**
 * Routines Module
 *
 * Paperclip Routines/Workflows integration with LangGraph.
 * Implements automated workflow execution with triggers and checkpointing.
 */

import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Controllers
import { RoutinesController, WebhooksController } from './routines.controller';

// Services
import { RoutineExecutionService } from './services/routine-execution.service';

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

@Module({
  imports: [DatabaseModule, AgentsModule, ToolsModule, forwardRef(() => require('../hermes/hermes.module').HermesModule)],
  controllers: [RoutinesController, WebhooksController],
  providers: [
    // Repositories (Injectable)
    PrismaRoutineRepository,
    PrismaRoutineTriggerRepository,
    PrismaRoutineRunRepository,

    // LangGraph
    RoutineGraph,

    // Execution Service
    RoutineExecutionService,
  ],
  exports: [
    // Export repositories for use by other modules
    PrismaRoutineRepository,
    PrismaRoutineTriggerRepository,
    PrismaRoutineRunRepository,

    // Export execution service for webhooks/events
    RoutineExecutionService,
  ],
})
export class RoutinesModule {}
