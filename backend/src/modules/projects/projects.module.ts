/**
 * Projects Module
 *
 * Following SOLID:
 * - Single Responsibility: Only wires up project dependencies
 * - Dependency Inversion: Uses token-based DI for repository
 *
 * Phase 2B: imports InformationEngineModule so the ProjectsAdapter
 * (engine bridge) is available. Binds the 'PROJECT_TYPES_SERVICE'
 * string token to ProjectTypesService — this was previously referenced
 * via the token but never bound, which would cause DI failure if the
 * production code path were ever exercised without the integration
 * test's manual provider override.
 */

import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService, PROJECT_REPOSITORY } from './projects.service';
import { PrismaProjectRepository } from './repositories/prisma-project.repository';
import { ProjectTypesModule } from '../project-types/project-types.module';
import { ProjectTypesService } from '../project-types/project-types.service';
import { InformationEngineModule } from '../information-engine/information-engine.module';

@Module({
  imports: [ProjectTypesModule, InformationEngineModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    {
      provide: PROJECT_REPOSITORY,
      useClass: PrismaProjectRepository,
    },
    {
      provide: 'PROJECT_TYPES_SERVICE',
      useExisting: ProjectTypesService,
    },
  ],
  exports: [ProjectsService, PROJECT_REPOSITORY],
})
export class ProjectsModule {}
