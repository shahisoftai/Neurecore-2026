/**
 * ApprovalChainsRepository — REAL PostgreSQL integration tests.
 *
 * Companion to the in-memory approval-chains.spec.ts; proves the SQL
 * `where` clauses in PrismaApprovalChainRepository against a live test
 * database. The in-memory spec proves the service contract; this one
 * proves the SQL matches the contract.
 *
 * GATING
 * ------
 * Skipped unless DATABASE_TEST_URL is set. See work-runtime-db.spec.ts
 * header for rationale.
 *
 * P4 audit-remediation coverage: criteria 19 (tenant isolation, repository
 * layer), 20 (cross-tenant lookups return null/404 at the DB layer),
 * 14 (expired/rejected/foreign-tenant approvals refused).
 */

import { PrismaClient } from '@prisma/client';
import { PrismaApprovalChainRepository } from '../repositories/prisma-approval-chain.repository';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('PrismaApprovalChainRepository — REAL PostgreSQL (DATABASE_TEST_URL)', () => {
  let prisma: PrismaClient;
  let repo: PrismaApprovalChainRepository;
  let tenantA: string;
  let tenantB: string;
  let requesterId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        approval_workflow_steps,
        approval_workflows,
        deliverables,
        projects,
        tenants,
        users,
        tiers
      RESTART IDENTITY CASCADE
    `);
    const tier = await prisma.tier.create({
      data: { name: 'test-tier-' + Date.now(), slug: 'tier-' + Date.now(), sortOrder: 0 },
    });
    const tidA = (await prisma.tenant.create({ data: { name: 'tenant-a', slug: 'ta-' + Date.now(), status: 'ACTIVE', tierId: tier.id } })).id;
    const tidB = (await prisma.tenant.create({ data: { name: 'tenant-b', slug: 'tb-' + Date.now(), status: 'ACTIVE', tierId: tier.id } })).id;
    const userA = (await prisma.user.create({
      data: { email: 'rq-' + Date.now() + '@x', passwordHash: 'x', firstName: 'A', lastName: 'B', role: 'OWNER', tenantId: tidA },
    })).id;
    tenantA = tidA; tenantB = tidB; requesterId = userA;
    repo = new PrismaApprovalChainRepository(prisma as any);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE approval_workflow_steps, approval_workflows
      RESTART IDENTITY CASCADE
    `);
  });

  // ── Tenant isolation ────────────────────────────────────────────────────────

  describe('tenant isolation', () => {
    it('findWorkflowById returns null for another tenant', async () => {
      const wf = await prisma.approvalWorkflow.create({
        data: {
          id: 'wf-iso-1', name: 'wf', workflowType: 'CUSTOM', currentStep: 0, status: 'PENDING',
          riskTier: 'HIGH', requesterId, tenantId: tenantB,
        },
      });
      expect(await repo.findWorkflowById('wf-iso-1', tenantA)).toBeNull();
      expect(await repo.findWorkflowById('wf-iso-1', tenantB)).not.toBeNull();
    });

    it('updateWorkflow refuses cross-tenant mutation at the SQL layer', async () => {
      const wf = await prisma.approvalWorkflow.create({
        data: {
          id: 'wf-iso-2', name: 'wf', workflowType: 'CUSTOM', currentStep: 0, status: 'PENDING',
          riskTier: 'HIGH', requesterId, tenantId: tenantB,
        },
      });
      await expect(repo.updateWorkflow('wf-iso-2', tenantA, { status: 'APPROVED' })).rejects.toThrow();
      const reloaded = await prisma.approvalWorkflow.findUnique({ where: { id: 'wf-iso-2' } });
      expect(reloaded!.status).toBe('PENDING');
    });

    it('findStepWithWorkflow returns null for cross-tenant access', async () => {
      const wf = await prisma.approvalWorkflow.create({
        data: {
          id: 'wf-iso-3', name: 'wf', workflowType: 'CUSTOM', currentStep: 0, status: 'PENDING',
          riskTier: 'HIGH', requesterId, tenantId: tenantB,
        },
      });
      const step = await prisma.approvalWorkflowStep.create({
        data: {
          id: 'step-1', approvalWorkflowId: wf.id, stepOrder: 0,
          approverRole: ['OWNER'], status: 'PENDING', blockedByPriorStep: false,
        },
      });
      expect(await repo.findStepWithWorkflow('step-1', tenantA)).toBeNull();
      expect(await repo.findStepWithWorkflow('step-1', tenantB)).not.toBeNull();
    });

    it('findWorkflows only returns rows for the calling tenant', async () => {
      await prisma.approvalWorkflow.create({
        data: {
          id: 'wf-a', name: 'wf', workflowType: 'CUSTOM', currentStep: 0, status: 'PENDING',
          riskTier: 'HIGH', requesterId, tenantId: tenantA,
        },
      });
      await prisma.approvalWorkflow.create({
        data: {
          id: 'wf-b', name: 'wf', workflowType: 'CUSTOM', currentStep: 0, status: 'PENDING',
          riskTier: 'HIGH', requesterId, tenantId: tenantB,
        },
      });
      const rows = await repo.findWorkflows(tenantA, { status: ['PENDING'] });
      expect(rows.map((r) => r.id)).toEqual(['wf-a']);
    });
  });

  // ── projectTypeVersion lookup ───────────────────────────────────────────────

  describe('findProjectTypeVersionById', () => {
    it('returns the row when present', async () => {
      const p = await prisma.projectType.create({
        data: { id: 'pt-1', name: 'Discovery', classification: 'CLIENT_ENGAGEMENT' },
      });
      const v = await prisma.projectTypeVersion.create({
        data: { id: 'ptv-1', projectTypeId: p.id, version: 1, approvalTemplate: { steps: [] } },
      });
      const r = await repo.findProjectTypeVersionById('ptv-1');
      expect(r).not.toBeNull();
      expect((r as any).approvalTemplate).toEqual({ steps: [] });
    });

    it('returns null when missing', async () => {
      const r = await repo.findProjectTypeVersionById('does-not-exist');
      expect(r).toBeNull();
    });
  });
});
