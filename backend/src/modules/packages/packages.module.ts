/**
 * PackagesModule — wires the Package pool (Pool #6, composite root).
 *
 * Imports the other pool modules so the Package composer can look up
 * Industries, TierTemplates and Features for the picker UI.
 */

import { Module, forwardRef } from '@nestjs/common';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { PackageDeploymentService } from './services/package-deployment.service';
import { IndustriesModule } from '../industry/industries.module';
import { TierTemplatesModule } from '../tier-templates/tier-templates.module';
import { FeaturesModule } from '../features/features.module';
import { DepartmentsPoolModule } from '../departments-pool/departments-pool.module';
import { AgentsPoolModule } from '../agents-pool/agents-pool.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    IndustriesModule,
    TierTemplatesModule,
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
