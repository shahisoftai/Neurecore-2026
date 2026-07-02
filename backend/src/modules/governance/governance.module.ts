import { Module } from '@nestjs/common';
import {
  GovernanceRulesController,
  GovernancePoliciesController,
  GovernanceAnomaliesController,
  ApprovalsController,
} from './governance.controller';
import { GovernanceRulesService } from './services/governance-rules.service';
import { ApprovalsService } from './services/approvals.service';
import { ApprovalScoringService } from './services/approval-scoring.service';
import { ApprovalEnrichmentService } from './services/approval-enrichment.service';

@Module({
  controllers: [
    GovernanceRulesController,
    GovernancePoliciesController,
    GovernanceAnomaliesController,
    ApprovalsController,
  ],
  providers: [
    GovernanceRulesService,
    ApprovalsService,
    ApprovalScoringService,
    ApprovalEnrichmentService,
  ],
  exports: [
    GovernanceRulesService,
    ApprovalsService,
    ApprovalScoringService,
    ApprovalEnrichmentService,
  ],
})
export class GovernanceModule { }
