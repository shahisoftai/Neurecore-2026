/**
 * project-health module — NestJS Module
 *
 * Phase 6: Health Score + BI Dashboards
 * Multi-signal composite scoring.
 *
 * SOLID: Single Responsibility — wires health dependencies.
 * Dependency Inversion: binds IProjectHealthRepository via token.
 */

import { Module } from '@nestjs/common';
import { ProjectHealthController } from './project-health.controller';
import { ProjectHealthService, PROJECT_HEALTH_REPOSITORY } from './project-health.service';
import { PrismaProjectHealthRepository } from './repositories/prisma-project-health.repository';

@Module({
  controllers: [ProjectHealthController],
  providers: [
    ProjectHealthService,
    {
      provide: PROJECT_HEALTH_REPOSITORY,
      useClass: PrismaProjectHealthRepository,
    },
  ],
  exports: [ProjectHealthService],
})
export class ProjectHealthModule {}
