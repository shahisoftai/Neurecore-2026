/**
 * Continuous Discovery — Module (Phase 2F)
 *
 * Wires the MiniCronService, the ContinuousDiscoveryService, and the
 * ContinuousDiscoveryController. Exports the discovery service so the
 * ProjectStagesModule + DeliverablesModule can wire the recompute hooks.
 *
 * Cron is started in `OnApplicationBootstrap` (idempotent).
 */

import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ContinuousDiscoveryService } from './continuous-discovery.service';
import { ContinuousDiscoveryController } from './continuous-discovery.controller';
import { MiniCronService } from './mini-cron.service';
import { CompletenessModule } from '../completeness/completeness.module';

@Module({
  imports: [CompletenessModule],
  controllers: [ContinuousDiscoveryController],
  providers: [MiniCronService, ContinuousDiscoveryService],
  exports: [
    ContinuousDiscoveryService,
    MiniCronService,
  ],
})
export class ContinuousDiscoveryModule implements OnApplicationBootstrap {
  constructor(private readonly discovery: ContinuousDiscoveryService) {}

  onApplicationBootstrap(): void {
    this.discovery.startCron();
  }
}