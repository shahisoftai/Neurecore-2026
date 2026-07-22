import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingChecklistModule } from './checklist/checklist.module';
import { ProjectTypeAllocatorModule } from '../project-types/allocators/project-type-allocator.module';
import { TenantTemplatesModule } from '../tenant-templates/tenant-templates.module';
import { DepartmentsModule } from '../departments/departments.module';
import { IndustriesModule } from '../industry/industries.module';
import { TiersModule } from '../tiers/tiers.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [
    OnboardingChecklistModule,
    ProjectTypeAllocatorModule,
    TenantTemplatesModule,
    DepartmentsModule,
    IndustriesModule,
    // Phase 3: TiersModule exports TierProvisioningService for the
    // industry-aware default-agent selection in complete().
    TiersModule,
    // Phase 7 G1: KnowledgeModule exports IndustryKnowledgeSeeder for
    // tenant-scoped knowledge corpus seeding at onboarding.
    KnowledgeModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService, OnboardingChecklistModule],
})
export class OnboardingModule {}
