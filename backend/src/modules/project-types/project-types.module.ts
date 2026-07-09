/**
 * ProjectTypes Module — Phase 2 ProjectType CRUD + Versioning
 *
 * Following SOLID:
 * - Single Responsibility: Only wires up project-type dependencies
 * - Dependency Inversion: Uses token-based DI for repository
 *
 * Phase 2G: imports ProjectTypeAllocatorModule so the onboarding flow
 * can clone system project types when a tenant completes onboarding.
 */

import { Module } from '@nestjs/common';
import { ProjectTypesController } from './project-types.controller';
import { ProjectTypesService } from './project-types.service';
import { PrismaProjectTypeRepository } from './repositories/prisma-project-type.repository';
import { I_PROJECT_TYPE_REPOSITORY } from './interfaces/project-type.interface';
import { ProjectTypeAllocatorModule } from './allocators/project-type-allocator.module';

@Module({
  imports: [ProjectTypeAllocatorModule],
  controllers: [ProjectTypesController],
  providers: [
    ProjectTypesService,
    {
      provide: I_PROJECT_TYPE_REPOSITORY,
      useClass: PrismaProjectTypeRepository,
    },
  ],
  exports: [ProjectTypesService, ProjectTypeAllocatorModule],
})
export class ProjectTypesModule {}
