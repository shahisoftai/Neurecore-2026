/**
 * TiersModule - SOLID: Single Responsibility Principle
 *
 * SRP: Only handles tier and agent pool concerns
 * OCP: Extends via interfaces
 * DIP: All dependencies injected, not instantiated
 *
 * Phase 3 adds TierResolver + TierChangeService + TierUpgradeService for
 * Tier × Industry runtime wiring (INDUSTRY-SETUP-CONCEPT.md §3.3).
 */

import { Module } from '@nestjs/common';
import { TiersController } from './tiers.controller';
import { TiersService } from './tiers.service';
import { TierProvisioningService } from './services/tier-provisioning.service';
import { TierResolver } from './services/tier-resolver.service';
import { TierChangeService } from './services/tier-change.service';
import { TierUpgradeService } from './services/tier-upgrade.service';
import { AgentPoolService } from './services/agent-pool.service';
import { AgentPoolController } from './agent-pool.controller';

@Module({
  controllers: [TiersController, AgentPoolController],
  providers: [
    TiersService,
    TierProvisioningService,
    TierResolver,
    TierChangeService,
    TierUpgradeService,
    AgentPoolService,
  ],
  exports: [
    TiersService,
    TierProvisioningService,
    TierResolver,
    TierChangeService,
    TierUpgradeService,
    AgentPoolService,
  ],
})
export class TiersModule {}
