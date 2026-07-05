/**
 * AgentsPoolModule — wires the AI Employees pool (Pool #1).
 */

import { Module } from '@nestjs/common';
import { AgentsPoolController } from './agents-pool.controller';
import { AgentsPoolService } from './agents-pool.service';

@Module({
  controllers: [AgentsPoolController],
  providers: [AgentsPoolService],
  exports: [AgentsPoolService],
})
export class AgentsPoolModule {}
