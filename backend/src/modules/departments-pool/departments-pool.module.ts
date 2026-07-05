/**
 * DepartmentsPoolModule — wires the Departments pool (Pool #2).
 */

import { Module } from '@nestjs/common';
import { DepartmentsPoolController } from './departments-pool.controller';
import { DepartmentsPoolService } from './departments-pool.service';

@Module({
  controllers: [DepartmentsPoolController],
  providers: [DepartmentsPoolService],
  exports: [DepartmentsPoolService],
})
export class DepartmentsPoolModule {}
