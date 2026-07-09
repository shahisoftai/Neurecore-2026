/**
 * execution-log module — NestJS Module
 *
 * Phase 4: Append-only task execution log.
 * No update/delete exposed.
 *
 * SOLID: Single Responsibility — wires log entry dependencies.
 * Dependency Inversion: binds IExecutionLogRepository via token.
 */

import { Module } from '@nestjs/common';
import { ExecutionLogController } from './execution-log.controller';
import { ExecutionLogService, EXECUTION_LOG_REPOSITORY } from './execution-log.service';
import { PrismaExecutionLogRepository } from './repositories/prisma-execution-log.repository';

@Module({
  controllers: [ExecutionLogController],
  providers: [
    ExecutionLogService,
    {
      provide: EXECUTION_LOG_REPOSITORY,
      useClass: PrismaExecutionLogRepository,
    },
  ],
  exports: [ExecutionLogService],
})
export class ExecutionLogModule {}
