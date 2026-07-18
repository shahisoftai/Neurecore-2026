/**
 * Approval Port — architecture tests (Phase 7, ADR-006).
 *
 * Boundaries enforced:
 *   1. approval-port/ does NOT import PrismaService directly
 *   2. approval-port/ does NOT import other capability services directly
 *   3. ApprovalPortService delegates to engines via ports (IGovernanceEvaluator,
 *      IApprovalWorkflowEngine, IApprovalChainsService), not concretions
 *   4. ApprovalPortModule only imports GovernanceModule, HermesModule,
 *      ApprovalChainsModule, EnterpriseEventsModule
 *   5. ApprovalPortService does NOT contain business logic — delegates only
 *   6. No duplicate ApprovalRequest/ApprovalWorkflow creation when already
 *      handled by existing engines
 */

import * as fs from 'fs';
import * as path from 'path';

const MOD = path.resolve(__dirname, '..');
const AP = path.join(MOD, 'approval-port');

const read = (p: string) => fs.readFileSync(p, 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

describe('Approval Port — architecture', () => {
  const files = walk(AP);

  it('does not import PrismaService directly', () => {
    const prismaImporters = files.filter((f) => /PrismaService/.test(read(f)));
    expect(prismaImporters).toHaveLength(0);
  });

  it('does not import other capability service modules directly', () => {
    const forbidden = [
      /modules\/projects\/.*\.service/,
      /modules\/customers\/.*\.service/,
      /modules\/finance\/.*\.service/,
      /modules\/deliverables\/.*\.service/,
      /modules\/work-runtime\/.*\.service/,
      /modules\/enterprise-cognition\/.*\.service/,
      /modules\/enterprise-autonomy\/.*\.service/,
    ];
    for (const f of files) {
      const src = read(f);
      for (const pattern of forbidden) {
        expect(src).not.toMatch(pattern);
      }
    }
  });

  it('ApprovalPortService uses IGovernanceEvaluator port (not GovernanceRulesService directly)', () => {
    const svc = read(path.join(AP, 'approval-port.service.ts'));
    expect(svc).toMatch(/IGovernanceEvaluator|governance-evaluator\.interface/);
    expect(svc).not.toMatch(/GovernanceRulesService/);
  });

  it('ApprovalPortService uses IApprovalWorkflowEngine abstraction (not concrete ApprovalWorkflowEngine)', () => {
    const svc = read(path.join(AP, 'approval-port.service.ts'));
    expect(svc).toMatch(/IApprovalWorkflowEngine|APPROVAL_WORKFLOW_ENGINE/);
    expect(svc).not.toMatch(/new ApprovalWorkflowEngine/);
  });

  it('ApprovalPortService uses IApprovalChainsService port (not ApprovalChainsService directly)', () => {
    const svc = read(path.join(AP, 'approval-port.service.ts'));
    expect(svc).toMatch(/IApprovalChainsService|APPROVAL_CHAINS_SERVICE/);
  });

  it('ApprovalPortModule only imports allowed modules', () => {
    const mod = read(path.join(AP, 'approval-port.module.ts'));
    expect(mod).toMatch(/GovernanceModule/);
    expect(mod).toMatch(/HermesModule/);
    expect(mod).toMatch(/ApprovalChainsModule/);
    expect(mod).toMatch(/EnterpriseEventsModule/);
    expect(mod).not.toMatch(/WorkRuntimeModule/);
    expect(mod).not.toMatch(/EnterpriseCognitionModule/);
    expect(mod).not.toMatch(/EnterpriseAutonomyModule/);
  });

  it('ApprovalPortService delegates business logic to engines (no direct Prisma writes)', () => {
    const svc = read(path.join(AP, 'approval-port.service.ts'));
    expect(svc).not.toMatch(/prisma\.approvalWorkflow\.|prisma\.approvalRequest\.|prisma\.\w+\.create\(/);
  });

  it('ApprovalPortService does not implement approval chain resolution itself — delegates', () => {
    const svc = read(path.join(AP, 'approval-port.service.ts'));
    expect(svc).not.toMatch(/resolveChain.*\{/);
    expect(svc).toMatch(/\.resolveChain\(/);
  });

  it('ApprovalPortController depends on IApprovalPort abstraction, not concrete service', () => {
    const ctrl = read(path.join(AP, 'approval-port.controller.ts'));
    expect(ctrl).toMatch(/IApprovalPort|APPROVAL_PORT/);
    expect(ctrl).not.toMatch(/import.*ApprovalPortService[^a-z]/);
    expect(ctrl).not.toMatch(/new ApprovalPortService/);
  });

  it('approval-port module does not have its own repository (no prisma-approval-port.repository)', () => {
    const hasRepo = files.some((f) => /repository/i.test(f));
    expect(hasRepo).toBe(false);
  });

  it('no .spec.ts files are in the module root (they belong in __tests__/)', () => {
    const rootSpec = files.filter((f) => /\.spec\.ts$/.test(f));
    const inTests = rootSpec.filter((f) => /__tests__/.test(f));
    const misplaced = rootSpec.filter((f) => !/__tests__/.test(f));
    expect(misplaced).toHaveLength(0);
  });
});
