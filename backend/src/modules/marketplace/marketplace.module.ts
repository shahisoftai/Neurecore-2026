/**
 * MarketplaceModule — unified marketplace facade.
 *
 * Phase 7, Task 7.3 (per EAOS-implementation-roadmap.md §11).
 */

import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './services/marketplace.service';
import { SolutionPacksModule } from '../solution-packs/solution-packs.module';

@Module({
  imports: [SolutionPacksModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
