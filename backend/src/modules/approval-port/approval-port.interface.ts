/**
 * Approval Port — Public Interface (ADR-006)
 *
 * Phase 7: Unified Capability Approval Port
 *
 * Single entry point for all approval requests across the enterprise.
 * Consolidates three disconnected systems:
 *   1. GovernanceRulesService  — pre-execution gating (preserved, consumed via IGovernanceEvaluator)
 *   2. ApprovalsService (governance/) — simple approval CRUD
 *   3. ApprovalWorkflowEngine (Hermes) — multi-step state machine
 *   4. ApprovalChainsService — risk-tier chain resolution
 *
 * SOLID:
 *   SRP — this interface defines only the capability boundary contract
 *   ISP — typed sub-interfaces group related operations
 *   DIP — consumers depend on this abstraction, not concrete engines
 */

import type { RiskTier, ApprovalStatus, ApprovalPriority } from '@prisma/client';

export const APPROVAL_PORT = Symbol('APPROVAL_PORT');

// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface WorkActor {
  id: string;
  type: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  name?: string | null;
  role?: string | null;
  tenantId: string;
}

export interface ApprovalContext {
  tenantId: string;
  projectId: string | null;
  resourceType: 'deliverable' | 'expense' | 'stage_completion' | 'agent_action' | 'work_run_step' | string;
  resourceId: string;
  riskTier: RiskTier | null;
  priority: ApprovalPriority;
  amount: number | null;
  currency: string | null;
}

export interface ApprovalRequestData {
  title: string;
  description: string | null;
  payload: Record<string, unknown> | null;
  expiresAt: string | null;
  workRequestId: string | null;
  correlationId: string;
}

export interface ApprovalRequestResult {
  approvalId: string;
  status: 'PENDING' | 'AUTO_APPROVED' | 'REJECTED';
  requiresHumanReview: boolean;
  expectedReviewerRole: string | null;
  estimatedResponseTime: string | null;
}

export interface ApprovalDecision {
  approvalId: string;
  decision: 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_REVISION';
  reason: string | null;
  revisionInstructions: string | null;
  correlationId: string;
}

export interface ApprovalDecisionResult {
  approvalId: string;
  status: ApprovalStatus;
  eventEmitted: boolean;
}

export interface ApprovalRequirement {
  requiresApproval: boolean;
  riskTier: RiskTier;
  maxAutonomyLevel: number;
  reason: string | null;
  autoApproved: boolean;
  governanceAllowed: boolean;
  triggeredRules: string[];
}

export interface ApprovalStatusResult {
  approvalId: string;
  status: ApprovalStatus;
  currentStep: number;
  totalSteps: number;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  decidedBy: WorkActor | null;
  history: ApprovalStatusHistoryEntry[];
}

export interface ApprovalStatusHistoryEntry {
  event: string;
  at: string;
  actor?: string;
}

// ─── IApprovalPort Interface ───────────────────────────────────────────────────

/**
 * Unified approval capability port.
 *
 * Consumers (Work Runtime, Enterprise Autonomy, etc.) use this as the single
 * entry point. Implementation delegates to the appropriate underlying engine
 * based on request type:
 *   - Risk-tier deliverable approval → ApprovalWorkflowEngine + ApprovalChainsService
 *   - Simple agent action approval    → ApprovalWorkflowEngine (basic workflow)
 *   - Pre-execution gating check      → IGovernanceEvaluator
 */
export interface IApprovalPort {
  /**
   * Request approval for an action or decision.
   *
   * Flow:
   *   1. evaluateRequirement() — governance rule check + risk tier evaluation
   *   2a. AUTO-APPROVE  → record in governance service, emit granted event
   *   2b. REQUIRE APPROVAL → create workflow (chain or basic), notify approver,
   *                           emit requested event
   *
   * Returns immediately with the approvalId and whether human review is needed.
   * The requesting actor receives the decision via event subscription.
   */
  request(
    context: ApprovalContext,
    actor: WorkActor,
    request: ApprovalRequestData,
  ): Promise<ApprovalRequestResult>;

  /**
   * Record an approval or rejection decision.
   *
   * Flow:
   *   1. Route to correct engine (governance approvals service OR workflow engine)
   *   2. Record decision
   *   3. Emit enterprise.approval.granted / .rejected
   *   4. Notify original actor
   *
   * For RETURNED_FOR_REVISION: emits rejected with revisionRequired set so
   * the Work Runtime enters REVISING state.
   */
  decide(
    decision: ApprovalDecision,
    reviewer: WorkActor,
    comment?: string,
  ): Promise<ApprovalDecisionResult>;

  /**
   * Check if an action requires approval without initiating a request.
   * Used by Work Runtime pre-execution gating.
   */
  evaluateRequirement(
    context: ApprovalContext,
    actor: WorkActor,
  ): Promise<ApprovalRequirement>;

  /**
   * Get the current status of an approval request.
   * Tries workflow engine first, falls back to governance approvals service.
   */
  getStatus(approvalId: string, tenantId: string): Promise<ApprovalStatusResult | null>;

  /**
   * Cancel a pending approval request.
   * Only the original requester can cancel.
   */
  cancel(approvalId: string, actorId: string, tenantId: string): Promise<void>;
}

// ─── Internal Engine Abstractions (DIP) ───────────────────────────────────────

/**
 * IApprovalWorkflowEngine — abstraction over ApprovalWorkflowEngine (Hermes).
 *
 * Defined here (in the consumer module) to avoid a hard import into this
 * module. Bound via APPROVAL_WORKFLOW_ENGINE token in ApprovalPortModule.
 */
export const APPROVAL_WORKFLOW_ENGINE = Symbol('APPROVAL_WORKFLOW_ENGINE');

export interface ApprovalStepInput {
  stepOrder: number;
  approverRole: string[];
  approverId?: string | null;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  workflowType: string;
  context?: Record<string, unknown>;
  steps: ApprovalStepInput[];
  requesterId: string;
  tenantId: string;
  workspaceId?: string | null;
  routineRunId?: string | null;
  riskTier?: RiskTier;
  targetDeliverableId?: string | null;
  projectId?: string | null;
}

export type WorkflowDecision = 'APPROVED' | 'REJECTED';

export interface WorkflowStatusResult {
  id: string;
  name: string;
  status: ApprovalStatus;
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    id: string;
    stepOrder: number;
    approverRole: string[];
    approverId: string | null;
    status: ApprovalStatus;
    decision: string | null;
    comment: string | null;
    decidedAt: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface IApprovalWorkflowEngine {
  create(input: CreateWorkflowInput): Promise<{ id: string }>;
  advance(
    workflowId: string,
    approverId: string,
    decision: WorkflowDecision,
    comment?: string,
  ): Promise<any>;
  cancel(workflowId: string, requesterId: string, reason?: string): Promise<any>;
  getStatus(workflowId: string, tenantId: string): Promise<any>;
  canApprove(workflowId: string, userId: string, tenantId: string): Promise<boolean>;
  getPendingForApprover(userId: string, tenantId: string): Promise<any[]>;
}
