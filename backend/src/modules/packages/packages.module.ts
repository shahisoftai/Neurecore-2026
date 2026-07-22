/**
 * PackagesModule — wires the Package pool (Pool #6, composite root).
 *
 * Imports the other pool modules so the Package composer can look up
 * Industries, Tiers and Features for the picker UI.
 *
 * TIER-SYSTEM-CONCEPT.md Phase 3: TierTemplatesModule removed; the Tier
 * module is the canonical tier source for Package composition.
 */

import { Module, forwardRef } from '@nestjs/common';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { PackageDeploymentService } from './services/package-deployment.service';
import { IndustriesModule } from '../industry/industries.module';
import { TiersModule } from '../tiers/tiers.module';
import { FeaturesModule } from '../features/features.module';
import { DepartmentsPoolModule } from '../departments-pool/departments-pool.module';
import { AgentsPoolModule } from '../agents-pool/agents-pool.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    IndustriesModule,
    TiersModule,
    FeaturesModule,
    DepartmentsPoolModule,
    AgentsPoolModule,
    forwardRef(() => AgentsModule),
  ],
  controllers: [PackagesController],
  providers: [PackagesService, PackageDeploymentService],
  exports: [PackagesService, PackageDeploymentService],
})
export class PackagesModule {}
