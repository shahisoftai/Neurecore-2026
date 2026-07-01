/**
 * TiersModule - SOLID: Single Responsibility Principle
 *
 * SRP: Only handles tier and agent pool concerns
 * OCP: Extends via interfaces
 * DIP: All dependencies injected, not instantiated
 */

import { Module } from '@nestjs/common';
import { TiersController } from './tiers.controller';
import { TiersService } from './tiers.service';
import { TierProvisioningService } from './services/tier-provisioning.service';
import { AgentPoolService } from './services/agent-pool.service';
import { AgentPoolController } from './agent-pool.controller';

@Module({
  controllers: [TiersController, AgentPoolController],
  providers: [TiersService, TierProvisioningService, AgentPoolService],
  exports: [TiersService, TierProvisioningService, AgentPoolService],
})
export class TiersModule {}
