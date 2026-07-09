import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingChecklistModule } from './checklist/checklist.module';
import { ProjectTypeAllocatorModule } from '../project-types/allocators/project-type-allocator.module';

@Module({
  imports: [OnboardingChecklistModule, ProjectTypeAllocatorModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService, OnboardingChecklistModule],
})
export class OnboardingModule {}
