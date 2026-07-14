/**
 * IGovernanceEvaluator — governance evaluation port (ADR-009).
 *
 * Defined in the governance module (the owner). Consumers (e.g. the Context
 * Plane, Approval Port) depend on this port, NOT the concrete
 * GovernanceRulesService. GovernanceRulesService remains in governance/ and is
 * bound to this token via useExisting.
 */

export const GOVERNANCE_EVALUATOR = Symbol('GOVERNANCE_EVALUATOR');

export interface GovernanceEvaluation {
  allowed: boolean;
  requiresApproval: boolean;
  triggeredRules: string[];
  actions: string[];
}

export interface IGovernanceEvaluator {
  /**
   * Evaluate a context object against active governance rules for a tenant.
   * Used for pre-execution gating and for Context Plane authority resolution.
   */
  evaluate(
    tenantId: string,
    context: Record<string, unknown>,
  ): Promise<GovernanceEvaluation>;
}
