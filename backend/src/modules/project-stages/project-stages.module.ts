/**
 * ProjectStages Module
 *
 * Phase 2F: imports the ContinuousDiscoveryModule so the
 * ProjectStagesService can call `onStageCompleted` when a stage moves
 * to COMPLETED. The dependency is one-way: stages → engine/cron.
 */

import { Module } from '@nestjs/common';
import { ProjectStagesController } from './project-stages.controller';
import { ProjectStagesService } from './project-stages.service';
import { PrismaProjectStageRepository } from './repositories/prisma-project-stage.repository';
import { PROJECT_STAGE_REPOSITORY } from './interfaces/project-stage.interface';
import { ContinuousDiscoveryModule } from '../information-engine/cron/continuous-discovery.module';

@Module({
  imports: [ContinuousDiscoveryModule],
  controllers: [ProjectStagesController],
  providers: [
    ProjectStagesService,
    {
      provide: PROJECT_STAGE_REPOSITORY,
      useClass: PrismaProjectStageRepository,
    },
  ],
  exports: [ProjectStagesService],
})
export class ProjectStagesModule {}
