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
import { GOVERNANCE_EVALUATOR } from './interfaces/governance-evaluator.interface';

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
    // ADR-009: expose governance evaluation as a port. GovernanceRulesService
    // stays owned by governance/; consumers depend on the port.
    { provide: GOVERNANCE_EVALUATOR, useExisting: GovernanceRulesService },
  ],
  exports: [
    GovernanceRulesService,
    ApprovalsService,
    ApprovalScoringService,
    ApprovalEnrichmentService,
    GOVERNANCE_EVALUATOR,
  ],
})
export class GovernanceModule {}
