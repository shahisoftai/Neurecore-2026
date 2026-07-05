import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingChecklistModule } from './checklist/checklist.module';

@Module({
  imports: [OnboardingChecklistModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService, OnboardingChecklistModule],
})
export class OnboardingModule {}
