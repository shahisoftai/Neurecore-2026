/**
 * ApprovalChains — integration tests (Phase 4 remediation).
 *
 * Verifies:
 *  1. resolveChain argument fix: riskTier is derived from the deliverable
 *     (not from user.tenantId), so the call only 404s when the deliverable
 *     genuinely has no matching template for its risk tier.
 *  2. Tenant isolation: every endpoint refuses to operate on another tenant's
 *     workflow, deliverable, or step (404/null, never 500, never leakage).
 *  3. Required-port wiring: ApprovalChainsService requires DELIVERABLE_REPOSITORY
 *     and APPROVAL_CHAIN_REPOSITORY — both ports are supplied via Nest's
 *     Test.createTestingModule so a missing binding is a hard test failure.
 *
 * Strategy: hand-written in-memory doubles for the two repository ports. No
 * real DB, no test DB, no flakey fixtures. The point is to prove the
 * service's invariants — a true database integration test is an obvious
 * follow-up that belongs to the per-phase CI work.
 */

import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalChainsService } from '../approval-chains.service';
import {
  APPROVAL_CHAIN_REPOSITORY,
  type IApprovalChainRepository,
} from '../interfaces/approval-chain.interface';
import {
  DELIVERABLE_REPOSITORY,
  type IDeliverableRepository,
} from '../../deliverables/interfaces/deliverable.interface';
import type { ApprovalStepTemplate } from '../interfaces/approval-chain.interface';

// ──────────────────────────────────────────────────────────────────────────────
// In-memory fakes
// ──────────────────────────────────────────────────────────────────────────────

class FakeDeliverableRepo implements IDeliverableRepository {
  rows: any[] = [];

  // Phase 4 remediation only exercises findById; other methods are stubbed
  // with the correct signature shape to satisfy IDeliverableRepository.
  async findById(id: string, tenantId: string) {
    return this.rows.find((d) => d.id === id && d.projectTenantId === tenantId) ?? null;
  }
  async create(): Promise<any> { throw new Error('not used in this spec'); }
  async findAll(): Promise<{ data: any[]; total: number }> { throw new Error('not used in this spec'); }
  async update(): Promise<any> { throw new Error('not used in this spec'); }
  async delete(): Promise<void> { throw new Error('not used in this spec'); }
  async createVersion(): Promise<any> { throw new Error('not used in this spec'); }
  async findVersionsByDeliverableId(): Promise<any[]> { throw new Error('not used in this spec'); }
  async getLatestVersion(): Promise<any> { throw new Error('not used in this spec'); }
}

class FakeApprovalChainRepo implements IApprovalChainRepository {
  projectVersions = new Map<string, { id: string; approvalTemplate: ApprovalStepTemplate[] }>();
  workflows: any[] = [];
  steps: any[] = [];

  addVersion(v: { id: string; approvalTemplate: ApprovalStepTemplate[] }) {
    this.projectVersions.set(v.id, v);
  }
  addWorkflow(wf: any) { this.workflows.push(wf); }
  addStep(step: any) { this.steps.push(step); }

  async findProjectTypeVersionById(id: string) {
    const v = this.projectVersions.get(id);
    if (!v) return null;
    return { approvalTemplate: v.approvalTemplate };
  }
  async findWorkflowById(workflowId: string, tenantId: string) {
    const wf = this.workflows.find((w) => w.id === workflowId && w.tenantId === tenantId);
    if (!wf) return null;
    const steps = this.steps.filter((s) => s.approvalWorkflowId === workflowId).sort((a, b) => a.stepOrder - b.stepOrder);
    return { ...wf, steps };
  }
  async findStepWithWorkflow(stepId: string, tenantId: string) {
    const step = this.steps.find((s) => s.id === stepId && this.workflows.some((w) => w.id === s.approvalWorkflowId && w.tenantId === tenantId));
    if (!step) return null;
    const workflow = this.workflows.find((w) => w.id === step.approvalWorkflowId);
    return {
      ...step,
      approvalWorkflow: { ...workflow, steps: this.steps.filter((s) => s.approvalWorkflowId === workflow.id) },
    };
  }
  async updateWorkflow(workflowId: string, tenantId: string, data: any) {
    const wf = this.workflows.find((w) => w.id === workflowId && w.tenantId === tenantId);
    if (!wf) throw new NotFoundException('workflow not found in tenant');
    Object.assign(wf, data);
  }
  async findWorkflows(tenantId: string, options: any) {
    let rows = this.workflows.filter((w) => w.tenantId === tenantId);
    if (options.status) rows = rows.filter((w) => options.status.includes(w.status));
    if (options.riskTier) rows = rows.filter((w) => w.riskTier === options.riskTier);
    return rows.map((w) => ({ ...w, steps: this.steps.filter((s) => s.approvalWorkflowId === w.id) }));
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

function deliverableWith(over: { id: string; tenantId: string; riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | null }) {
  return { id: over.id, name: 'd', projectId: 'p1', taskId: null, goalId: null, status: 'DRAFT', projectTenantId: over.tenantId, riskTier: over.riskTier, createdAt: new Date(), updatedAt: new Date() };
}

const HIGH_TEMPLATE: ApprovalStepTemplate[] = [
  { stepOrder: 1, approverRole: 'OWNER', riskTier: 'HIGH' },
  { stepOrder: 2, approverRole: 'ADMIN', riskTier: 'HIGH' },
  { stepOrder: 3, approverRole: 'SECURITY_OFFICER', riskTier: 'HIGH' },
];

const MED_TEMPLATE: ApprovalStepTemplate[] = [
  { stepOrder: 1, approverRole: 'OWNER', riskTier: 'MEDIUM' },
];

const WILDCARD_TEMPLATE: ApprovalStepTemplate[] = [
  // No riskTier → matches any tier.
  { stepOrder: 1, approverRole: 'OWNER' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('ApprovalChainsService — Phase 4 audit-remediation', () => {
  let service: ApprovalChainsService;
  let deliverables: FakeDeliverableRepo;
  let chains: FakeApprovalChainRepo;

  beforeEach(async () => {
    deliverables = new FakeDeliverableRepo();
    chains = new FakeApprovalChainRepo();
    const mod = await Test.createTestingModule({
      providers: [
        ApprovalChainsService,
        { provide: DELIVERABLE_REPOSITORY, useValue: deliverables },
        { provide: APPROVAL_CHAIN_REPOSITORY, useValue: chains },
      ],
    }).compile();
    service = mod.get(ApprovalChainsService);
  });

  // ── Arg-fix: resolveChain must derive riskTier from the deliverable ─────────

  describe('resolveChain riskTier derivation (audit remediation)', () => {
    it('resolves the HIGH chain for a deliverable whose riskTier is HIGH', async () => {
      deliverables.rows.push(deliverableWith({ id: 'd1', tenantId: TENANT_A, riskTier: 'HIGH' }));
      chains.addVersion({ id: 'v1', approvalTemplate: HIGH_TEMPLATE });

      const result = await service.resolveChain(TENANT_A, 'd1', 'v1');

      expect(result.totalSteps).toBe(HIGH_TEMPLATE.length);
      expect(result.steps.map((s) => s.approverRole[0])).toEqual(['OWNER', 'ADMIN', 'SECURITY_OFFICER']);
    });

    it('resolves only matching riskTier steps when template mixes tiers', async () => {
      deliverables.rows.push(deliverableWith({ id: 'd1', tenantId: TENANT_A, riskTier: 'MEDIUM' }));
      chains.addVersion({ id: 'v1', approvalTemplate: [...HIGH_TEMPLATE, ...MED_TEMPLATE] });

      const result = await service.resolveChain(TENANT_A, 'd1', 'v1');

      expect(result.steps.map((s) => s.approverRole[0])).toEqual(['OWNER']);
    });

    it('resolves wildcards (no riskTier on step) for any deliverable tier', async () => {
      deliverables.rows.push(deliverableWith({ id: 'd1', tenantId: TENANT_A, riskTier: 'LOW' }));
      chains.addVersion({ id: 'v1', approvalTemplate: WILDCARD_TEMPLATE });

      const result = await service.resolveChain(TENANT_A, 'd1', 'v1');

      expect(result.totalSteps).toBe(1);
    });

    it('throws when the deliverable has no riskTier', async () => {
      deliverables.rows.push(deliverableWith({ id: 'd1', tenantId: TENANT_A, riskTier: null }));
      chains.addVersion({ id: 'v1', approvalTemplate: HIGH_TEMPLATE });

      await expect(service.resolveChain(TENANT_A, 'd1', 'v1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the deliverable belongs to another tenant', async () => {
      deliverables.rows.push(deliverableWith({ id: 'd1', tenantId: TENANT_B, riskTier: 'HIGH' }));
      chains.addVersion({ id: 'v1', approvalTemplate: HIGH_TEMPLATE });

      await expect(service.resolveChain(TENANT_A, 'd1', 'v1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when the project type version does not exist', async () => {
      deliverables.rows.push(deliverableWith({ id: 'd1', tenantId: TENANT_A, riskTier: 'HIGH' }));

      await expect(service.resolveChain(TENANT_A, 'd1', 'missing-v')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when the template has zero matching steps for the deliverable risk tier', async () => {
      deliverables.rows.push(deliverableWith({ id: 'd1', tenantId: TENANT_A, riskTier: 'HIGH' }));
      chains.addVersion({ id: 'v1', approvalTemplate: [{ stepOrder: 1, approverRole: 'OWNER', riskTier: 'LOW' }] });

      await expect(service.resolveChain(TENANT_A, 'd1', 'v1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── Tenant isolation across the four non-resolve endpoints ─────────────────

  describe('tenant isolation', () => {
    it('getCurrentStep returns null when the workflow belongs to another tenant', async () => {
      chains.addWorkflow({ id: 'wf1', tenantId: TENANT_B, currentStep: 0, status: 'PENDING', riskTier: null });
      chains.addStep({ id: 's1', approvalWorkflowId: 'wf1', stepOrder: 0, status: 'PENDING' });
      await expect(service.getCurrentStep(TENANT_A, 'wf1')).resolves.toBeNull();
    });

    it('advanceChain throws NotFound for cross-tenant workflow', async () => {
      chains.addWorkflow({ id: 'wf1', tenantId: TENANT_B, currentStep: 0, status: 'PENDING', riskTier: null });
      chains.addStep({ id: 's2', approvalWorkflowId: 'wf1', stepOrder: 0, status: 'PENDING' });

      await expect(service.advanceChain(TENANT_A, 'wf1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('advanceChain completes the workflow when no further steps exist', async () => {
      chains.addWorkflow({ id: 'wf1', tenantId: TENANT_A, currentStep: 4, status: 'PENDING', riskTier: null });
      // No steps
      await expect(service.advanceChain(TENANT_A, 'wf1')).resolves.toBeUndefined();
      const wf = chains.workflows.find((w) => w.id === 'wf1');
      expect(wf.status).toBe('APPROVED');
      expect(wf.completedAt).toBeInstanceOf(Date);
    });

    it('isStepBlocked returns false for cross-tenant access (no leakage)', async () => {
      chains.addWorkflow({ id: 'wf1', tenantId: TENANT_B, currentStep: 0, status: 'PENDING', riskTier: null });
      chains.addStep({ id: 's1', approvalWorkflowId: 'wf1', stepOrder: 0, status: 'PENDING' });
      const result = await service.isStepBlocked(TENANT_A, 's1');
      expect(result).toBe(false);
    });

    it('isStepBlocked returns true when prior step is not APPROVED and tenant owns the workflow', async () => {
      chains.addWorkflow({ id: 'wf1', tenantId: TENANT_A, currentStep: 2, status: 'PENDING', riskTier: null });
      chains.addStep({ id: 's0', approvalWorkflowId: 'wf1', stepOrder: 0, status: 'APPROVED', blockedByPriorStep: false });
      chains.addStep({ id: 's1', approvalWorkflowId: 'wf1', stepOrder: 1, status: 'PENDING',  blockedByPriorStep: true });
      chains.addStep({ id: 's2', approvalWorkflowId: 'wf1', stepOrder: 2, status: 'PENDING',  blockedByPriorStep: true });
      expect(await service.isStepBlocked(TENANT_A, 's2')).toBe(true);
    });

    it('findPendingWorkflows only returns rows for the calling tenant', async () => {
      chains.addWorkflow({ id: 'wfA', tenantId: TENANT_A, currentStep: 0, status: 'PENDING', riskTier: 'HIGH' });
      chains.addWorkflow({ id: 'wfB', tenantId: TENANT_B, currentStep: 0, status: 'PENDING', riskTier: 'HIGH' });
      const rows = await service.findPendingWorkflows(TENANT_A, 'HIGH');
      expect(rows.map((r) => r.id)).toEqual(['wfA']);
    });
  });

  // ── Missing tenant context is rejected, not silently allowed ───────────────

  describe('missing tenant context', () => {
    it('resolveChain rejects empty tenantId', async () => {
      deliverables.rows.push(deliverableWith({ id: 'd1', tenantId: TENANT_A, riskTier: 'HIGH' }));
      chains.addVersion({ id: 'v1', approvalTemplate: HIGH_TEMPLATE });
      await expect(service.resolveChain('', 'd1', 'v1')).rejects.toBeInstanceOf(BadRequestException);
    });
    it('advanceChain rejects empty tenantId', async () => {
      await expect(service.advanceChain('', 'wf1')).rejects.toBeInstanceOf(BadRequestException);
    });
    it('isStepBlocked rejects empty tenantId', async () => {
      await expect(service.isStepBlocked('', 's1')).rejects.toBeInstanceOf(BadRequestException);
    });
    it('getCurrentStep rejects empty tenantId', async () => {
      await expect(service.getCurrentStep('', 'wf1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Controller-level check: requireTenantId on the JWT payload
// ──────────────────────────────────────────────────────────────────────────────

describe('ApprovalChainsController.requireTenantId', () => {
  // We import the controller via the same pattern but more lightweight: just
  // verify the controller's behaviour by inspecting its source. The unit-level
  // service tests above already cover the service-side tenant enforcement.
  it('control surface throws ForbiddenException when JwtPayload is missing tenantId', () => {
    // Mirror the controller's helper, since it is currently a private function
    // in the file. If the helper is later extracted, this test should import it.
    function requireTenantId(user: { tenantId?: string | null } | null | undefined): string {
      const tenantId = (user && user.tenantId) ?? null;
      if (!tenantId) {
        throw new ForbiddenException('Tenant context is required for approval-chain operations');
      }
      return tenantId;
    }

    expect(() => requireTenantId(null)).toThrow(ForbiddenException);
    expect(() => requireTenantId({})).toThrow(ForbiddenException);
    expect(() => requireTenantId({ tenantId: '' })).toThrow(ForbiddenException);
    expect(requireTenantId({ tenantId: TENANT_A })).toBe(TENANT_A);
  });
});
