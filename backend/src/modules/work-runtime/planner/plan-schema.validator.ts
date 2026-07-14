/**
 * Deterministic WorkPlan schema validation (ADR-003 §6).
 * Every planner output is validated against this schema before any step can
 * execute. Invalid plans are rejected (the planner may attempt a bounded repair
 * once). No malformed plan reaches tool execution.
 */

import type { WorkPlan, ToolEffect } from '../contracts/work-runtime.interface';

export class PlanValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`WorkPlan validation failed: ${issues.join('; ')}`);
    this.name = 'PlanValidationError';
  }
}

const EFFECTS: ToolEffect[] = ['READ', 'INTERNAL_WRITE', 'EXTERNAL_WRITE'];

/**
 * Validate + normalize a raw planner object into a typed WorkPlan.
 * @param registeredToolNames tools the actor is authorized to use; any step
 *   naming a tool outside this set is rejected (planner cannot invent tools).
 */
export function validatePlan(
  raw: unknown,
  registeredToolNames: Set<string>,
): WorkPlan {
  const issues: string[] = [];
  const o = (raw ?? {}) as Record<string, unknown>;

  if (typeof o.objective !== 'string' || o.objective.trim() === '') {
    issues.push('objective must be a non-empty string');
  }
  const assumptions = Array.isArray(o.assumptions)
    ? o.assumptions.filter((x) => typeof x === 'string')
    : [];
  const requiredContextCapabilities = Array.isArray(o.requiredContextCapabilities)
    ? o.requiredContextCapabilities.filter((x) => typeof x === 'string')
    : [];
  const completionCriteria = Array.isArray(o.completionCriteria)
    ? o.completionCriteria.filter((x) => typeof x === 'string')
    : [];

  const rawSteps = Array.isArray(o.steps) ? o.steps : null;
  if (!rawSteps) issues.push('steps must be an array');

  const steps =
    (rawSteps ?? []).map((s, idx) => {
      const st = (s ?? {}) as Record<string, unknown>;
      const id = typeof st.id === 'string' && st.id ? st.id : `step-${idx + 1}`;
      const toolName = typeof st.toolName === 'string' ? st.toolName : '';
      if (!toolName) issues.push(`step ${id}: missing toolName`);
      else if (!registeredToolNames.has(toolName)) {
        issues.push(`step ${id}: tool "${toolName}" is not registered/authorized`);
      }
      const effect = (EFFECTS as string[]).includes(String(st.effect))
        ? (st.effect as ToolEffect)
        : 'READ';
      const input =
        st.input && typeof st.input === 'object'
          ? (st.input as Record<string, unknown>)
          : {};
      const dependsOn = Array.isArray(st.dependsOn)
        ? st.dependsOn.filter((x) => typeof x === 'string')
        : [];
      return {
        id,
        sequence: typeof st.sequence === 'number' ? st.sequence : idx + 1,
        description: typeof st.description === 'string' ? st.description : '',
        toolName,
        capability: typeof st.capability === 'string' ? st.capability : '',
        input,
        dependsOn,
        effect,
        expectedOutput:
          typeof st.expectedOutput === 'string' ? st.expectedOutput : '',
      };
    });

  if (steps.length === 0) issues.push('plan must contain at least one step');
  if (steps.length > 20) issues.push('plan exceeds max 20 steps (bounded)');

  if (issues.length > 0) throw new PlanValidationError(issues);

  return {
    objective: o.objective as string,
    assumptions,
    requiredContextCapabilities,
    steps,
    completionCriteria,
  };
}
