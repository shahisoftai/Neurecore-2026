/**
 * project-decisions module — NestJS Module
 *
 * Phase 5: Decision Registry
 * Decisions with voting and approval tracking.
 *
 * SOLID: Single Responsibility — wires decision dependencies.
 * Dependency Inversion: binds IProjectDecisionRepository via token.
 */

import { Module } from '@nestjs/common';
import { ProjectDecisionsController } from './project-decisions.controller';
import {
  ProjectDecisionService,
  PROJECT_DECISION_REPOSITORY,
} from './project-decisions.service';
import { PrismaProjectDecisionRepository } from './repositories/prisma-project-decision.repository';

@Module({
  controllers: [ProjectDecisionsController],
  providers: [
    ProjectDecisionService,
    {
      provide: PROJECT_DECISION_REPOSITORY,
      useClass: PrismaProjectDecisionRepository,
    },
  ],
  exports: [ProjectDecisionService],
})
export class ProjectDecisionsModule {}
