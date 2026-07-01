import { Module } from '@nestjs/common';
import {
  GovernanceRulesController,
  GovernancePoliciesController,
  GovernanceAnomaliesController,
  ApprovalsController,
} from './governance.controller';
import { GovernanceRulesService } from './services/governance-rules.service';
import { ApprovalsService } from './services/approvals.service';

@Module({
  controllers: [
    GovernanceRulesController,
    GovernancePoliciesController,
    GovernanceAnomaliesController,
    ApprovalsController,
  ],
  providers: [GovernanceRulesService, ApprovalsService],
  exports: [GovernanceRulesService, ApprovalsService],
})
export class GovernanceModule {}
