/**
 * AutonomyRepository — REAL PostgreSQL integration tests.
 *
 * Companion to the in-memory autonomy spec. Proves the SQL `where`
 * clauses and tenant-scoping of the four autonomy tables at the DB
 * layer. Gated on DATABASE_TEST_URL.
 *
 * P6 audit-remediation coverage:
 *  - tenant isolation at the SQL layer (missions, employees, departments,
 *    observations)
 *  - optimistic concurrency on mission.version
 *  - countActiveMissions only counts the CREATED/PLANNED/ASSIGNED/RUNNING/
 *    WAITING/ESCALATED states
 *  - adjustWorkload(delta=0) must NOT overwrite availability (the
 *    audit-remediation fix).
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { AutonomyRepository } from '../repository/autonomy.repository';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('AutonomyRepository — REAL PostgreSQL (DATABASE_TEST_URL)', () => {
  let prisma: PrismaClient;
  let repo: AutonomyRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        mission_observations,
        missions,
        ai_employees,
        ai_departments
      RESTART IDENTITY CASCADE
    `);
    repo = new AutonomyRepository(prisma as any);
  });

  afterAll(async () => { await prisma.$disconnect(); });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        mission_observations, missions, ai_employees, ai_departments
      RESTART IDENTITY CASCADE
    `);
  });

  // ── Tenant isolation ────────────────────────────────────────────────────────

  describe('tenant isolation', () => {
    it('findMission returns null cross-tenant', async () => {
      await repo.createMission({
        tenantId: 'tenant-a', createdById: 'user-a',
        title: 'M', objective: 'o', priority: 'MEDIUM',
      });
      expect(await repo.findMission('m_1', 'tenant-b')).toBeNull();
    });

    it('countActiveMissions is tenant-scoped', async () => {
      for (let i = 0; i < 3; i++) {
        await repo.createMission({ tenantId: 'tenant-a', createdById: 'u', title: `A${i}`, objective: 'o' });
      }
      for (let i = 0; i < 2; i++) {
        await repo.createMission({ tenantId: 'tenant-b', createdById: 'u', title: `B${i}`, objective: 'o' });
      }
      expect(await repo.countActiveMissions('tenant-a')).toBe(3);
      expect(await repo.countActiveMissions('tenant-b')).toBe(2);
    });
  });

  // ── Optimistic concurrency ────────────────────────────────────────────────

  describe('optimistic concurrency on mission.version', () => {
    it('first writer at version=0 wins; second writer at the same version loses', async () => {
      const m = await repo.createMission({
        tenantId: 'tenant-a', createdById: 'u',
        title: 'M', objective: 'o',
      });
      const ok1 = await repo.updateMission(m.id, 'tenant-a', 0, { status: 'PLANNED' });
      const ok2 = await repo.updateMission(m.id, 'tenant-a', 0, { status: 'RUNNING' });
      expect(ok1).toBe(true);
      expect(ok2).toBe(false);
      const row = await repo.findMission(m.id, 'tenant-a');
      expect(row!.status).toBe('PLANNED');
      expect((row as any).version).toBe(1);
    });
  });

  // ── countActiveMissions scope (the lifecycle states) ─────────────────────

  describe('countActiveMissions', () => {
    it('counts CREATED/PLANNED/ASSIGNED/RUNNING/WAITING/ESCALATED only', async () => {
      const m1 = await repo.createMission({ tenantId: 't', createdById: 'u', title: 'M', objective: 'o' });
      await prisma.mission.update({ where: { id: m1.id }, data: { status: 'COMPLETED' } });
      const m2 = await repo.createMission({ tenantId: 't', createdById: 'u', title: 'M2', objective: 'o2' });
      await prisma.mission.update({ where: { id: m2.id }, data: { status: 'CANCELLED' } });
      expect(await repo.countActiveMissions('t')).toBe(0);

      await repo.createMission({ tenantId: 't', createdById: 'u', title: 'M3', objective: 'o3' });
      expect(await repo.countActiveMissions('t')).toBe(1);
    });
  });

  // ── adjustWorkload edge case (audit-remediation) ─────────────────────────

  describe('adjustWorkload', () => {
    it('delta=0 does NOT change currentWorkload or availability', async () => {
      // Seed an ai_employees row directly via Prisma using UncheckedCreateInput
      // so the typed Prisma client accepts the partial payload (defaults fill the
      // rest at the DB layer).
      const e1 = await prisma.aiEmployee.create({
        data: {
          tenantId: 't', name: 'Bot', role: 'AI',
          currentWorkload: 5, availability: 'BUSY',
          confidenceThreshold: 'MEDIUM', healthStatus: 'GOOD', updatedAt: new Date(),
        } as Prisma.AiEmployeeUncheckedCreateInput,
      });
      await (repo as any).adjustWorkload(e1.id, 't', 0);
      const after = await prisma.aiEmployee.findUnique({ where: { id: e1.id } });
      expect(after!.availability).toBe('BUSY'); // not reset to AVAILABLE
      expect(after!.currentWorkload).toBe(5);    // not touched
    });

    it('positive delta increments workload and sets availability to BUSY', async () => {
      const e1 = await prisma.aiEmployee.create({
        data: {
          tenantId: 't', name: 'Bot', role: 'AI',
          currentWorkload: 2, availability: 'AVAILABLE',
          confidenceThreshold: 'MEDIUM', healthStatus: 'GOOD', updatedAt: new Date(),
        } as Prisma.AiEmployeeUncheckedCreateInput,
      });
      await (repo as any).adjustWorkload(e1.id, 't', 3);
      const after = await prisma.aiEmployee.findUnique({ where: { id: e1.id } });
      expect(after!.currentWorkload).toBe(5);
      expect(after!.availability).toBe('BUSY');
    });
  });

  // ── createObservation ──────────────────────────────────────────────────────

  describe('createObservation persistence', () => {
    it('persists with tenantId and evidence', async () => {
      await repo.createObservation({
        tenantId: 't',
        watcher: 'project-health',
        observation: 'low completeness',
        severity: 'MEDIUM',
        confidence: 'HIGH',
        evidence: [{ source: 'CONTEXT_PLANE', reference: 'p', detail: 'x' }],
        affectedDepartments: [],
        affectedProjects: ['p-1'],
        recommendedAction: 'act',
        requiresRuntime: true,
        requiresApproval: false,
      } as any);
      const rows = await prisma.missionObservation.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0].tenantId).toBe('t');
      expect(rows[0].watcher).toBe('project-health');
      expect(rows[0].severity).toBe('MEDIUM');
      expect((rows[0].evidenceJson as any)).toEqual([{ source: 'CONTEXT_PLANE', reference: 'p', detail: 'x' }]);
    });
  });
});
