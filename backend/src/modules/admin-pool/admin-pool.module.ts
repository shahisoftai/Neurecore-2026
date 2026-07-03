/**
 * AdminPoolModule — wires the Admin Pool platform-catalog + Industry × Tier
 * packages backend (per `memory-bank-new/admin-pool.md` §4).
 *
 * Imports:
 *   - DatabaseModule (global) — PrismaService
 *
 * Exports:
 *   - PoolCatalogService — for future MarketPlace integrations
 *   - IndustryPackagesService — for the onboarding wizard integration
 */

import { Global, Module } from '@nestjs/common';
import { PoolCatalogService } from './services/pool-catalog.service';
import { IndustryPackagesService } from './services/industry-packages.service';
import { IndustriesController } from './controllers/industries.controller';
import { PoolCategoriesController } from './controllers/pool-categories.controller';
import { PoolAgentsController } from './controllers/pool-agents.controller';
import { IndustryPackagesController } from './controllers/industry-packages.controller';

@Global()
@Module({
  controllers: [
    IndustriesController,
    PoolCategoriesController,
    PoolAgentsController,
    IndustryPackagesController,
  ],
  providers: [PoolCatalogService, IndustryPackagesService],
  exports: [PoolCatalogService, IndustryPackagesService],
})
export class AdminPoolModule {}
