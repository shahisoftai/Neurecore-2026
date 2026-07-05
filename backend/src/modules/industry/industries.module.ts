/**
 * IndustriesModule — wires the Industry pool.
 *
 * Phase 10 — Admin Business Composition.
 * Re-exports IndustriesService for downstream modules (Package editor).
 */

import { Module } from '@nestjs/common';
import { IndustriesController } from './industries.controller';
import { IndustriesService } from './industries.service';

@Module({
  controllers: [IndustriesController],
  providers: [IndustriesService],
  exports: [IndustriesService],
})
export class IndustriesModule {}
