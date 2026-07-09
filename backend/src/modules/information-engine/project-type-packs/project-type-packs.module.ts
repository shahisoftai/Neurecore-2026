/**
 * ProjectTypePacks — Module (Phase 2B)
 */

import { Module } from '@nestjs/common';
import { ProjectTypePacksService } from './project-type-packs.service';
import { ProjectTypePacksController } from './project-type-packs.controller';
import { PROJECT_TYPE_PACK_REPOSITORY } from './interfaces/project-type-pack.interface';
import { PrismaProjectTypePackRepository } from './repositories/prisma-project-type-pack.repository';
import { QuestionPacksModule } from '../packs/question-packs.module';

@Module({
  imports: [QuestionPacksModule],
  controllers: [ProjectTypePacksController],
  providers: [
    ProjectTypePacksService,
    {
      provide: PROJECT_TYPE_PACK_REPOSITORY,
      useClass: PrismaProjectTypePackRepository,
    },
  ],
  exports: [ProjectTypePacksService],
})
export class ProjectTypePacksModule {}
