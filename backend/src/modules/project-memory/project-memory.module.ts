/**
 * project-memory module — NestJS Module
 *
 * Phase 5: Project Memory
 * Append-only institutional knowledge.
 *
 * SOLID: Single Responsibility — wires memory dependencies.
 * Dependency Inversion: binds IProjectMemoryRepository via token.
 */

import { Module } from '@nestjs/common';
import { ProjectMemoryController } from './project-memory.controller';
import { ProjectMemoryService, PROJECT_MEMORY_REPOSITORY } from './project-memory.service';
import { PrismaProjectMemoryRepository } from './repositories/prisma-project-memory.repository';

@Module({
  controllers: [ProjectMemoryController],
  providers: [
    ProjectMemoryService,
    {
      provide: PROJECT_MEMORY_REPOSITORY,
      useClass: PrismaProjectMemoryRepository,
    },
  ],
  exports: [ProjectMemoryService],
})
export class ProjectMemoryModule {}
