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
import { ProjectHealthAIService } from './project-health-ai.service';
import { PrismaProjectHealthRepository } from './repositories/prisma-project-health.repository';
import { ModelsModule } from '../models/models.module';

@Module({
  imports: [ModelsModule],
  controllers: [ProjectHealthController],
  providers: [
    ProjectHealthService,
    ProjectHealthAIService,
    {
      provide: PROJECT_HEALTH_REPOSITORY,
      useClass: PrismaProjectHealthRepository,
    },
  ],
  exports: [ProjectHealthService, ProjectHealthAIService],
})
export class ProjectHealthModule {}
