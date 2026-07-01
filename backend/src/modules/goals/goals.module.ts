/**
 * Goals Module - NestJS Module Configuration
 *
 * Following SOLID:
 * - Single Responsibility: Only wires up Goals-related dependencies
 * - Dependency Inversion: Binds IGoalRepository to PrismaGoalRepository via token
 */

import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService, GOAL_REPOSITORY } from './goals.service';
import { PrismaGoalRepository } from './repositories/prisma-goal.repository';

@Module({
  controllers: [GoalsController],
  providers: [
    GoalsService,
    {
      provide: GOAL_REPOSITORY,
      useClass: PrismaGoalRepository,
    },
  ],
  exports: [GoalsService],
})
export class GoalsModule {}
