/**
 * ApprovalPortModule — Phase 7 (ADR-006)
 *
 * Unified Capability Approval Port module.
 *
 * Imports:
 *   - GovernanceModule  — IGovernanceEvaluator port
 *   - HermesModule       — ApprovalWorkflowEngine (via APPROVAL_WORKFLOW_ENGINE token)
 *   - ApprovalChainsModule — IApprovalChainsService port
 *   - EnterpriseEventsModule — EVENT_TRANSPORT for publishing approval events
 *
 * Architecture (ADR-006 §Architecture):
 *   ApprovalPortService is the SINGLE entry point for all approval requests.
 *   Existing engines are NOT deleted — they are delegated to:
 *     - GovernanceRulesService     → pre-execution gating (evaluateRequirement)
 *     - ApprovalWorkflowEngine     → multi-step workflow management
 *     - ApprovalChainsService      → risk-tier chain resolution for deliverables
 *
 * SOLID:
 *   SRP — module wires dependencies; service handles orchestration
 *   DIP — ApprovalPortService depends on abstractions (IGovernanceEvaluator,
 *         IApprovalWorkflowEngine, IApprovalChainsService), not concretions
 *   OCP — new approval types handled by extending delegation logic
 */

import { Module } from '@nestjs/common';
import { GovernanceModule } from '../governance/governance.module';
import { HermesModule } from '../hermes/hermes.module';
import { ApprovalChainsModule } from '../approval-chains/approval-chains.module';
import { EnterpriseEventsModule } from '../enterprise-events/enterprise-events.module';
import { ApprovalPortService } from './approval-port.service';
import { ApprovalPortController } from './approval-port.controller';
import { ApprovalWorkflowEngine } from '../hermes/services/approval-workflow.engine';
import { ApprovalChainsService } from '../approval-chains/approval-chains.service';
import {
  APPROVAL_PORT,
  APPROVAL_WORKFLOW_ENGINE,
} from './approval-port.interface';
import { APPROVAL_CHAINS_SERVICE } from '../approval-chains/interfaces/approval-chain.interface';

@Module({
  imports: [
    GovernanceModule,
    HermesModule,
    ApprovalChainsModule,
    EnterpriseEventsModule,
  ],
  controllers: [ApprovalPortController],
  providers: [
    ApprovalPortService,
    // DIP: ApprovalPortService depends on IApprovalWorkflowEngine (abstraction).
    // We bind the concrete ApprovalWorkflowEngine from Hermes to our token.
    { provide: APPROVAL_WORKFLOW_ENGINE, useExisting: ApprovalWorkflowEngine },
    // DIP: ApprovalPortService depends on IApprovalChainsService (abstraction).
    // ApprovalChainsService is the concrete implementation exported by ApprovalChainsModule.
    { provide: APPROVAL_CHAINS_SERVICE, useExisting: ApprovalChainsService },
    // Main export token
    { provide: APPROVAL_PORT, useExisting: ApprovalPortService },
  ],
  exports: [
    ApprovalPortService,
    APPROVAL_PORT,
  ],
})
export class ApprovalPortModule {}
