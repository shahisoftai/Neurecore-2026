/**
 * Plan schema validation + runtime governance — unit tests (Phase 4 §18 unit).
 */

import { validatePlan, PlanValidationError } from './planner/plan-schema.validator';
import { RuntimeGovernanceEvaluator } from './governance/runtime-governance.evaluator';
import type { RuntimeTool } from './contracts/work-runtime.interface';

const REGISTERED = new Set(['projects.get_summary', 'tasks.create']);

function goodPlanRaw() {
  return {
    objective: 'do a thing',
    assumptions: [],
    requiredContextCapabilities: ['projects'],
    steps: [
      { id: 's1', sequence: 1, description: 'read', toolName: 'projects.get_summary', capability: 'projects', input: { projectId: 'p1' }, dependsOn: [], effect: 'READ', expectedOutput: 'summary' },
    ],
    completionCriteria: ['done'],
  };
}

describe('validatePlan', () => {
  it('accepts a well-formed plan referencing registered tools', () => {
    const plan = validatePlan(goodPlanRaw(), REGISTERED);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].toolName).toBe('projects.get_summary');
  });

  it('rejects a plan referencing an unregistered tool', () => {
    const raw = goodPlanRaw();
    raw.steps[0].toolName = 'evil.delete_everything';
    expect(() => validatePlan(raw, REGISTERED)).toThrow(PlanValidationError);
  });

  it('rejects a plan with no steps', () => {
    const raw = goodPlanRaw();
    raw.steps = [];
    expect(() => validatePlan(raw, REGISTERED)).toThrow(/at least one step/);
  });

  it('rejects a plan missing objective', () => {
    const raw = goodPlanRaw() as Record<string, unknown>;
    delete raw.objective;
    expect(() => validatePlan(raw, REGISTERED)).toThrow(PlanValidationError);
  });

  it('rejects a plan exceeding the bounded step limit', () => {
    const raw = goodPlanRaw();
    raw.steps = Array.from({ length: 21 }, (_, i) => ({
      id: `s${i}`, sequence: i, description: '', toolName: 'projects.get_summary', capability: 'projects', input: {}, dependsOn: [], effect: 'READ', expectedOutput: '',
    }));
    expect(() => validatePlan(raw, REGISTERED)).toThrow(/max 20 steps/);
  });
});

describe('RuntimeGovernanceEvaluator', () => {
  const readTool: RuntimeTool = {
    name: 'projects.get_summary', capability: 'projects', description: '', effect: 'READ',
    requiredAuthority: 10, approvalSensitive: false, timeoutMs: 1000, maxRetries: 0,
    validateInput: () => {}, execute: async () => ({ ok: true }),
  };
  const writeTool: RuntimeTool = { ...readTool, name: 'tasks.create', effect: 'INTERNAL_WRITE', requiredAuthority: 50 };
  const externalTool: RuntimeTool = { ...readTool, name: 'projects.transition_status', effect: 'EXTERNAL_WRITE', requiredAuthority: 75, approvalSensitive: true };

  function evaluator(gov: { allowed: boolean; requiresApproval: boolean }) {
    const fake = { evaluate: jest.fn(async () => ({ allowed: gov.allowed, requiresApproval: gov.requiresApproval, triggeredRules: [], actions: [] })) };
    return new RuntimeGovernanceEvaluator(fake as never);
  }

  it('ALLOW: sufficient authority, governance allows, non-sensitive', async () => {
    const d = await evaluator({ allowed: true, requiresApproval: false }).evaluateStep({
      tenantId: 't1', actorId: 'a1', effectiveAuthority: 90, governanceBlocked: false, tool: readTool, input: {},
    });
    expect(d.outcome).toBe('ALLOW');
  });

  it('DENY: below required authority', async () => {
    const d = await evaluator({ allowed: true, requiresApproval: false }).evaluateStep({
      tenantId: 't1', actorId: 'a1', effectiveAuthority: 20, governanceBlocked: false, tool: writeTool, input: {},
    });
    expect(d.outcome).toBe('DENY');
    expect(d.reason).toMatch(/authority/);
  });

  it('DENY: governance blocked actor', async () => {
    const d = await evaluator({ allowed: true, requiresApproval: false }).evaluateStep({
      tenantId: 't1', actorId: 'a1', effectiveAuthority: 100, governanceBlocked: true, tool: readTool, input: {},
    });
    expect(d.outcome).toBe('DENY');
  });

  it('DENY: governance rule denies', async () => {
    const d = await evaluator({ allowed: false, requiresApproval: false }).evaluateStep({
      tenantId: 't1', actorId: 'a1', effectiveAuthority: 90, governanceBlocked: false, tool: writeTool, input: {},
    });
    expect(d.outcome).toBe('DENY');
  });

  it('REQUIRE_APPROVAL: approval-sensitive tool with sufficient authority', async () => {
    const d = await evaluator({ allowed: true, requiresApproval: false }).evaluateStep({
      tenantId: 't1', actorId: 'a1', effectiveAuthority: 90, governanceBlocked: false, tool: externalTool, input: {},
    });
    expect(d.outcome).toBe('REQUIRE_APPROVAL');
    expect(d.reason).toMatch(/approval-sensitive/);
  });

  it('REQUIRE_APPROVAL: governance requiresApproval', async () => {
    const d = await evaluator({ allowed: true, requiresApproval: true }).evaluateStep({
      tenantId: 't1', actorId: 'a1', effectiveAuthority: 90, governanceBlocked: false, tool: writeTool, input: {},
    });
    expect(d.outcome).toBe('REQUIRE_APPROVAL');
  });

  it('fail-safe: governance eval throws → read ALLOW, write REQUIRE_APPROVAL', async () => {
    const fake = { evaluate: jest.fn(async () => { throw new Error('down'); }) };
    const ev = new RuntimeGovernanceEvaluator(fake as never);
    const read = await ev.evaluateStep({ tenantId: 't1', actorId: 'a1', effectiveAuthority: 90, governanceBlocked: false, tool: readTool, input: {} });
    const write = await ev.evaluateStep({ tenantId: 't1', actorId: 'a1', effectiveAuthority: 90, governanceBlocked: false, tool: writeTool, input: {} });
    expect(read.outcome).toBe('ALLOW');
    expect(write.outcome).toBe('REQUIRE_APPROVAL');
  });
});
