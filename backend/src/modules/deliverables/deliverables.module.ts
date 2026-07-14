/**
 * Deliverables Module — NestJS Module Configuration
 *
 * Phase 3: Goals + Tasks → Deliverables
 *
 * Following SOLID:
 * - Single Responsibility: only wires up Deliverable-related dependencies
 * - Dependency Inversion: binds IDeliverableRepository to PrismaDeliverableRepository via token
 *
 * Phase 2F: imports ContinuousDiscoveryModule so the
 * DeliverablesService.submit hook can call `onDeliverableSubmitted`.
 */

import { Module } from '@nestjs/common';
import { DeliverablesController } from './deliverables.controller';
import { DeliverablesService } from './deliverables.service';
import { PrismaDeliverableRepository } from './repositories/prisma-deliverable.repository';
import { DELIVERABLE_REPOSITORY } from './interfaces/deliverable.interface';
import { ContinuousDiscoveryModule } from '../information-engine/cron/continuous-discovery.module';

@Module({
  imports: [ContinuousDiscoveryModule],
  controllers: [DeliverablesController],
  providers: [
    DeliverablesService,
    {
      provide: DELIVERABLE_REPOSITORY,
      useClass: PrismaDeliverableRepository,
    },
  ],
  exports: [DeliverablesService, DELIVERABLE_REPOSITORY],
})
export class DeliverablesModule {}
