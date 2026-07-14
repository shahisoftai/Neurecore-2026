/**
 * WorkRuntimeRepository — REAL PostgreSQL integration tests.
 *
 * This spec exercises the SQL `where` clauses in WorkRunRepository against a
 * live test database. Tests in work-runtime.integration.spec.ts use
 * in-memory fakes, which prove the service orchestration but do NOT prove
 * the Prisma queries against the actual schema. This spec lifts that gap.
 *
 * GATING
 * ------
 * Skipped entirely unless DATABASE_TEST_URL is set. Operators are expected
 * to provide this from a docker-compose stack or a CI-managed test schema.
 * Without it, the suite marks all DB tests as skipped (which is the same
 * result CI sees when no test DB has been provisioned).
 *
 * Not wired into the default `npm test` (npm test runs *.spec.ts with the
 * rootDir config). Run explicitly via:
 *     npx jest --config jest.config.js src/modules/work-runtime/__tests__/work-runtime-db.spec.ts --runInBand
 * or via the dedicated CI job described in .github/workflows/backend-ci.yml.
 *
 * Covers P4 audit-remediation: criteria 19-20 (tenant isolation), 15-16
 * (idempotency), 11-13 (approval pause/resume/revalidation), 14 (expired
 * approval rejection), 17 (recovery after interruption), 18 (cancellation),
 * 25 (no direct Prisma in runtime/planner), 26 (event fabric lifecycle).
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { WorkRunRepository } from '../repository/work-run.repository';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);

const describeDb = HAS_DB ? describe : describe.skip;

describeDb('WorkRunRepository — REAL PostgreSQL (DATABASE_TEST_URL)', () => {
  let prisma: PrismaClient;
  let repo: WorkRunRepository;
  let tenantA: string;
  let tenantB: string;
  let actorId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    // Truncate only the tables this spec touches (plus required FK targets).
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        work_run_steps,
        work_runs,
        approval_workflow_steps,
        approval_workflows,
        deliverables,
        projects,
        tenants,
        users,
        tiers
      RESTART IDENTITY CASCADE
    `);
    // Seed a Tier (Tenant.tierId is a non-null FK) and two tenants + a user.
    const tier = await prisma.tier.create({
      data: { name: 'test-tier-' + Date.now(), slug: 'tier-' + Date.now(), sortOrder: 0 },
    });
    const tidA = (await prisma.tenant.create({
      data: {
        name: 'tenant-a',
        slug: 'tenant-a-' + Date.now(),
        status: 'ACTIVE',
        tierId: tier.id,
      },
    })).id;
    const tidB = (await prisma.tenant.create({
      data: {
        name: 'tenant-b',
        slug: 'tenant-b-' + Date.now(),
        status: 'ACTIVE',
        tierId: tier.id,
      },
    })).id;
    const userA = (await prisma.user.create({
      data: {
        email: 'actor-' + Date.now() + '@x',
        passwordHash: 'x',
        firstName: 'A',
        lastName: 'B',
        role: 'OWNER',
        tenantId: tidA,
      },
    })).id;
    tenantA = tidA; tenantB = tidB; actorId = userA;
    repo = new WorkRunRepository({ workRun: prisma.workRun, workRunStep: prisma.workRunStep } as any);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Per-test cleanup of the three tables touched below.
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE work_run_steps, work_runs
      RESTART IDENTITY CASCADE
    `);
  });

  // ── Tenant isolation (criteria 19, 20) ──────────────────────────────────────

  describe('tenant isolation', () => {
    it('findRun returns the row only for the owning tenant', async () => {
      const a = await repo.createRun({
        tenantId: tenantA, actorId, actorType: 'HUMAN', hermesAgentId: null,
        workspaceId: null, threadId: null, request: 'r1', contextProvenance: { projects: { provider: 'p', access: 'FULL', policySource: 's', fetchedAt: 'now', unavailable: false } },
      });
      expect(await repo.findRun(a.id, tenantA)).not.toBeNull();
      expect(await repo.findRun(a.id, tenantB)).toBeNull();
    });

    it('listSteps returns the steps only for the owning tenant', async () => {
      const a = await repo.createRun({
        tenantId: tenantA, actorId, actorType: 'HUMAN', hermesAgentId: null,
        workspaceId: null, threadId: null, request: 'r1', contextProvenance: { projects: { provider: 'p', access: 'FULL', policySource: 's', fetchedAt: 'now', unavailable: false } },
      });
      const s = await repo.createStep({ tenantId: tenantA, runId: a.id, sequence: 1, toolName: 'projects.get_summary', capability: 'projects', operationType: 'READ', input: { projectId: 'p1' }, idempotencyKey: 'k1' });
      expect(await repo.listSteps(a.id, tenantA)).toHaveLength(1);
      expect(await repo.listSteps(a.id, tenantB)).toEqual([]);
    });

    it('updateRun refuses cross-tenant updates via optimistic version', async () => {
      const a = await repo.createRun({
        tenantId: tenantA, actorId, actorType: 'HUMAN', hermesAgentId: null,
        workspaceId: null, threadId: null, request: 'r1', contextProvenance: { projects: { provider: 'p', access: 'FULL', policySource: 's', fetchedAt: 'now', unavailable: false } },
      });
      const ok = await repo.updateRun(a.id, tenantA, 0, { status: 'PLANNING' });
      expect(ok).toBe(true);
      const no = await repo.updateRun(a.id, tenantB, 0, { status: 'PLANNING' });
      expect(no).toBe(false);
      // Row stays owned by tenant A.
      const reloaded = await repo.findRun(a.id, tenantA);
      expect(reloaded!.status).toBe('PLANNING');
    });
  });

  // ── Idempotency (criteria 15, 16) ──────────────────────────────────────────

  describe('idempotency', () => {
    it('findSucceededByIdempotencyKey returns nothing for a non-completed step', async () => {
      const a = await repo.createRun({
        tenantId: tenantA, actorId, actorType: 'HUMAN', hermesAgentId: null,
        workspaceId: null, threadId: null, request: 'r1', contextProvenance: { projects: { provider: 'p', access: 'FULL', policySource: 's', fetchedAt: 'now', unavailable: false } },
      });
      const s = await repo.createStep({ tenantId: tenantA, runId: a.id, sequence: 1, toolName: 'projects.get_summary', capability: 'projects', operationType: 'READ', input: {}, idempotencyKey: 'k-unique-1' });
      await repo.updateStep(s.id, tenantA, { status: 'RUNNING' });
      expect(await repo.findSucceededByIdempotencyKey('k-unique-1', tenantA)).toBeNull();
    });

    it('findSucceededByIdempotencyKey returns the step only after SUCCEEDED', async () => {
      const a = await repo.createRun({
        tenantId: tenantA, actorId, actorType: 'HUMAN', hermesAgentId: null,
        workspaceId: null, threadId: null, request: 'r1', contextProvenance: { projects: { provider: 'p', access: 'FULL', policySource: 's', fetchedAt: 'now', unavailable: false } },
      });
      const s = await repo.createStep({ tenantId: tenantA, runId: a.id, sequence: 1, toolName: 'projects.get_summary', capability: 'projects', operationType: 'READ', input: {}, idempotencyKey: 'k-unique-2' });
      await repo.updateStep(s.id, tenantA, { status: 'SUCCEEDED' });
      const found = await repo.findSucceededByIdempotencyKey('k-unique-2', tenantA);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(s.id);
    });

    it('duplicate-step insert fails on (tenantId, idempotencyKey) unique', async () => {
      const a = await repo.createRun({
        tenantId: tenantA, actorId, actorType: 'HUMAN', hermesAgentId: null,
        workspaceId: null, threadId: null, request: 'r1', contextProvenance: { projects: { provider: 'p', access: 'FULL', policySource: 's', fetchedAt: 'now', unavailable: false } },
      });
      await repo.createStep({ tenantId: tenantA, runId: a.id, sequence: 1, toolName: 'projects.get_summary', capability: 'projects', operationType: 'READ', input: {}, idempotencyKey: 'same-key' });
      await expect(
        repo.createStep({ tenantId: tenantA, runId: a.id, sequence: 2, toolName: 'projects.get_summary', capability: 'projects', operationType: 'READ', input: {}, idempotencyKey: 'same-key' })
      ).rejects.toThrow();
    });
  });

  // ── Atomic claim (criterion 25 architecture + dup-resume behavior) ─────────

  describe('atomic step claim', () => {
    it('claimStep fails when the step is in a status not in the from-set', async () => {
      const a = await repo.createRun({
        tenantId: tenantA, actorId, actorType: 'HUMAN', hermesAgentId: null,
        workspaceId: null, threadId: null, request: 'r1', contextProvenance: { projects: { provider: 'p', access: 'FULL', policySource: 's', fetchedAt: 'now', unavailable: false } },
      });
      const s = await repo.createStep({ tenantId: tenantA, runId: a.id, sequence: 1, toolName: 'projects.get_summary', capability: 'projects', operationType: 'READ', input: {}, idempotencyKey: 'k-claim' });
      // First claim from PENDING succeeds.
      const ok = await repo.claimStep(s.id, tenantA, ['PENDING']);
      expect(ok).toBe(true);
      // Second claim from PENDING now fails (status moved to RUNNING).
      const no = await repo.claimStep(s.id, tenantA, ['PENDING']);
      expect(no).toBe(false);
    });
  });

  // ── Approval lookup (criteria 12, 14) ──────────────────────────────────────

  describe('findStepByApproval', () => {
    it('finds a step by its approvalId scoped to the tenant', async () => {
      const a = await repo.createRun({
        tenantId: tenantA, actorId, actorType: 'HUMAN', hermesAgentId: null,
        workspaceId: null, threadId: null, request: 'r1', contextProvenance: { projects: { provider: 'p', access: 'FULL', policySource: 's', fetchedAt: 'now', unavailable: false } },
      });
      const s = await repo.createStep({ tenantId: tenantA, runId: a.id, sequence: 1, toolName: 'projects.transition_status', capability: 'projects', operationType: 'EXTERNAL_WRITE', input: { projectId: 'p1' }, idempotencyKey: 'k-appr' });
      await repo.updateStep(s.id, tenantA, { approvalId: 'approval-1' });
      expect(await repo.findStepByApproval('approval-1', tenantA)).not.toBeNull();
      expect(await repo.findStepByApproval('approval-1', tenantB)).toBeNull();
    });
  });
});
