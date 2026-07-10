/**
 * approval-chains module — Service
 *
 * Phase 4: Approval chain resolution.
 * - Filters approvalTemplate by riskTier matching deliverable's riskTier
 * - Ordered, sequential step progression
 * - blockedByPriorStep enforcement
 *
 * SOLID: Single Responsibility — owns approval chain resolution only.
 * DIP: depends on IApprovalChainRepository abstraction.
 */

import { Injectable, NotFoundException, BadRequestException, Logger, Inject } from '@nestjs/common';
import type {
  ApprovalStepTemplate,
  ApprovalChainResolution,
  ApprovalWorkflowStepWithChain,
  IApprovalChainRepository,
} from './interfaces/approval-chain.interface';
import { APPROVAL_CHAIN_REPOSITORY } from './interfaces/approval-chain.interface';

@Injectable()
export class ApprovalChainsService {
  private readonly logger = new Logger(ApprovalChainsService.name);

  constructor(
    @Inject(APPROVAL_CHAIN_REPOSITORY)
    private readonly repository: IApprovalChainRepository,
  ) {}

  /**
   * Resolve the approval chain for a deliverable.
   * Filters the project type's approvalTemplate by riskTier matching the deliverable's tier,
   * then returns ordered steps in sequential chain order.
   */
  async resolveChain(
    deliverableId: string,
    projectTypeVersionId: string,
    riskTier: string,
  ): Promise<ApprovalChainResolution> {
    const version = await this.repository.findProjectTypeVersionById(projectTypeVersionId);

    if (!version) {
      throw new NotFoundException(`ProjectTypeVersion ${projectTypeVersionId} not found`);
    }

    const template = (version.approvalTemplate ?? []) as unknown as ApprovalStepTemplate[];

    const matchingSteps = template
      .filter((s) => !s.riskTier || s.riskTier === riskTier)
      .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0));

    if (matchingSteps.length === 0) {
      throw new NotFoundException(
        `No approval steps found for risk tier '${riskTier}' on version ${projectTypeVersionId}`,
      );
    }

    const isSequential = matchingSteps.some((s) => s.chainStepOrder !== undefined);

    const totalSteps = isSequential
      ? Math.max(...matchingSteps.map((s) => s.chainStepOrder ?? 0)) + 1
      : matchingSteps.length;

    const chainSteps: ApprovalWorkflowStepWithChain[] = matchingSteps.map((s, idx) => ({
      id: `resolved-${idx}`,
      approvalWorkflowId: '',
      stepOrder: s.stepOrder ?? idx,
      approverRole: [s.approverRole],
      approverId: null,
      status: 'PENDING',
      decision: null,
      comment: null,
      decidedAt: null,
      chainStepOrder: s.chainStepOrder ?? 0,
      chainStepTotal: s.chainStepTotal ?? totalSteps,
      blockedByPriorStep: s.chainStepOrder !== undefined && s.chainStepOrder > 0,
    }));

    this.logger.debug(
      `Resolved ${matchingSteps.length} approval steps for deliverable ${deliverableId} (riskTier=${riskTier})`,
    );

    return {
      workflowId: `temp-${deliverableId}`,
      steps: chainSteps,
      isSequential,
      totalSteps,
    };
  }

  /**
   * Advance an approval workflow to the next sequential step.
   * Called after a step is approved/rejected.
   */
  async advanceChain(workflowId: string): Promise<void> {
    const workflow = await this.repository.findWorkflowById(workflowId);

    if (!workflow) {
      throw new NotFoundException(`ApprovalWorkflow ${workflowId} not found`);
    }

    const currentStepIdx = workflow.currentStep;
    const nextStep = workflow.steps[currentStepIdx + 1];

    if (!nextStep) {
      await this.repository.updateWorkflow(workflowId, {
        status: 'APPROVED',
        completedAt: new Date(),
      });
      this.logger.log(`ApprovalWorkflow ${workflowId} completed — no more steps`);
      return;
    }

    await this.repository.updateWorkflow(workflowId, {
      currentStep: currentStepIdx + 1,
    });
    this.logger.debug(`ApprovalWorkflow ${workflowId} advanced to step ${currentStepIdx + 1}`);
  }

  /**
   * Check if a step is blocked by its prior step in a sequential chain.
   */
  async isStepBlocked(stepId: string): Promise<boolean> {
    const step = await this.repository.findStepWithWorkflow(stepId);

    if (!step) return false;
    if (!step.blockedByPriorStep) return false;

    const currentIdx = step.approvalWorkflow.steps.findIndex((s) => s.id === stepId);
    if (currentIdx <= 0) return false;

    const priorStep = step.approvalWorkflow.steps[currentIdx - 1];
    return priorStep.status !== 'APPROVED';
  }

  /**
   * Get all pending approval workflows for a tenant.
   */
  async findPendingWorkflows(tenantId: string, riskTier?: string) {
    return this.repository.findWorkflows(tenantId, {
      status: ['PENDING'],
      riskTier,
    });
  }

  /**
   * Get the current pending step for a workflow.
   */
  async getCurrentStep(workflowId: string) {
    const workflow = await this.repository.findWorkflowById(workflowId);

    if (!workflow) return null;
    return workflow.steps[workflow.currentStep] ?? null;
  }
}
