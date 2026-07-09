/**
 * Information Engine — `appliesWhen` Evaluator
 *
 * Single source of truth (§3.4 of project-creation-imp-plan.md).
 * Both RequirementsService.resolveForProjectType() and
 * AdaptiveQuestioningService.pickNext() import this helper. No duplication.
 *
 * Semantics:
 *   - `hasCustomer: true`  → ctx.hasCustomer must be true.
 *   - `hasCustomer: false` → ctx.hasCustomer must be false.
 *   - `classification: [...]` → ctx.classification must be in the list.
 *   - `hasEntityField` → resolved via currentResponses (equality on value).
 *
 * A rule is in scope only if EVERY clause passes. A rule without
 * `appliesWhen` is always in scope.
 */

import type {
  AppliesWhenRule,
  ProjectTypeClassification,
} from '../../project-types/interfaces/project-type.interface';

export interface AppliesWhenContext {
  hasCustomer?: boolean;
  classification?: ProjectTypeClassification | null;
  currentResponses?: Array<{ questionId: string; value: unknown }>;
}

/**
 * Evaluate an `appliesWhen` rule against a runtime context.
 * Pure — no DB access, no side effects.
 */
export function evaluateAppliesWhen(
  rule: AppliesWhenRule | undefined,
  ctx: AppliesWhenContext,
): boolean {
  if (!rule) return true;

  if (rule.hasCustomer !== undefined) {
    if (rule.hasCustomer === true && ctx.hasCustomer !== true) return false;
    if (rule.hasCustomer === false && ctx.hasCustomer === true) return false;
  }

  if (
    rule.classification &&
    Array.isArray(rule.classification) &&
    rule.classification.length > 0
  ) {
    if (!ctx.classification) return false;
    if (!rule.classification.includes(ctx.classification)) return false;
  }

  return true;
}

/**
 * Filter an array of items by `appliesWhen` against a context.
 * Items with no `appliesWhen` always pass.
 */
export function filterByAppliesWhen<
  T extends { appliesWhen?: AppliesWhenRule },
>(items: T[], ctx: AppliesWhenContext): T[] {
  return items.filter((item) => evaluateAppliesWhen(item.appliesWhen, ctx));
}
