import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingChecklistModule } from './checklist/checklist.module';
import { ProjectTypeAllocatorModule } from '../project-types/allocators/project-type-allocator.module';
import { TenantTemplatesModule } from '../tenant-templates/tenant-templates.module';
import { DepartmentsModule } from '../departments/departments.module';

@Module({
  imports: [
    OnboardingChecklistModule,
    ProjectTypeAllocatorModule,
    TenantTemplatesModule,
    DepartmentsModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService, OnboardingChecklistModule],
})
export class OnboardingModule {}
