import { Module } from '@nestjs/common';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';

/**
 * OnboardingChecklistModule — the progressive onboarding wizard system of
 * record. See `memory-bank-new/plans/onboarding-progressive-wizard.md`.
 *
 * PR-1 scope: skeleton only — exposes CRUD on OnboardingChecklistEntry +
 * MissionFeedItem sync + audit logging. Per-wizard payload validation and
 * side effects (writing to Tenant/User fields) will be added in PR-3.
 */
@Module({
  controllers: [ChecklistController],
  providers: [ChecklistService],
  exports: [ChecklistService],
})
export class OnboardingChecklistModule {}
