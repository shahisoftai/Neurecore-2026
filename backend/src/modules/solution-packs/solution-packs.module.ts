/**
 * SolutionPacksModule — wires the EAOS-5 Solution Pack backend.
 *
 * Phase 7 (per `EAOS-implementation-roadmap.md` §11 +
 * `EAOS-implementation-plan.md` §9.8 + `EAOS-api-contract.md` §8.19).
 *
 * Imports:
 *   - TenantContextModule (global) — TenantContextService
 *   - WidgetsModule — for WidgetRegistry + WidgetsService re-use
 *   - AIActionsModule — for AIActionRegistry re-use
 *   - MissionFeedModule — for MissionFeedService (install preview items)
 *
 * Exports:
 *   - SolutionPacksService — for future Marketplace + vertical pack modules
 *   - PackValidator — for shared validation logic
 *   - PackApplier / PackUninstaller — for tenant lifecycle
 */

import { Module } from '@nestjs/common';
import { SolutionPacksController } from './solution-packs.controller';
import { SolutionPacksService } from './services/solution-packs.service';
import { PackValidator } from './services/pack-validator';
import { PackApplier } from './services/pack-applier';
import { PackUninstaller } from './services/pack-uninstaller';
import { WidgetsModule } from '../widgets/widgets.module';
import { AIActionsModule } from '../ai-actions/ai-actions.module';
import { MissionFeedModule } from '../mission-feed/mission-feed.module';

@Module({
  imports: [WidgetsModule, AIActionsModule, MissionFeedModule],
  controllers: [SolutionPacksController],
  providers: [
    SolutionPacksService,
    PackValidator,
    PackApplier,
    PackUninstaller,
  ],
  exports: [SolutionPacksService, PackValidator, PackApplier, PackUninstaller],
})
export class SolutionPacksModule {}
