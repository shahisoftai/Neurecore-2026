/**
 * Projects Module
 *
 * Following SOLID:
 * - Single Responsibility: Only wires up project dependencies
 * - Dependency Inversion: Uses token-based DI for repository
 */

import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService, PROJECT_REPOSITORY } from './projects.service';
import { PrismaProjectRepository } from './repositories/prisma-project.repository';

@Module({
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    {
      provide: PROJECT_REPOSITORY,
      useClass: PrismaProjectRepository,
    },
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
