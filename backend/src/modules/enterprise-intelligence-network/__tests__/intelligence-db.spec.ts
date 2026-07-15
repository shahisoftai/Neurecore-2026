/**
 * Enterprise Intelligence Network — REAL PostgreSQL integration tests.
 *
 * Companion to the in-memory P9 spec. Proves the SQL `where` clauses
 * in KnowledgeGraph and the parameterized Prisma.sql in `health()`
 * (audit-remediation: the original implementation interpolated
 * tenantId directly into a raw string, which is a SQL-injection hazard).
 *
 * GATED on DATABASE_TEST_URL.
 */

import { PrismaClient } from '@prisma/client';
import { KnowledgeGraph, OntologyManager } from '../engines/intelligence-engines.service';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('KnowledgeGraph — REAL PostgreSQL (DATABASE_TEST_URL)', () => {
  let prisma: PrismaClient;
  let kg: KnowledgeGraph;
  let om: OntologyManager;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        knowledge_edges, knowledge_nodes, ontology_versions
      RESTART IDENTITY CASCADE
    `);
    kg = new KnowledgeGraph(prisma as any);
    om = new OntologyManager(prisma as any);
  });

  afterAll(async () => { await prisma.$disconnect(); });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE knowledge_edges, knowledge_nodes, ontology_versions
      RESTART IDENTITY CASCADE
    `);
  });

  describe('KnowledgeGraph.upsertNode', () => {
    it('upsert is idempotent on (tenantId, entityKind, entityId)', async () => {
      const a = await kg.upsertNode('tenant-a', 'PROJECT', 'p1', 'P1');
      const b = await kg.upsertNode('tenant-a', 'PROJECT', 'p1', 'P1 (updated)');
      expect(a.id).toBe(b.id);
      expect(b.label).toBe('P1 (updated)');
      const rows = await prisma.knowledgeNode.findMany();
      expect(rows).toHaveLength(1);
    });

    it('tenant isolation: the same entityKind/entityId for two tenants are distinct rows', async () => {
      await kg.upsertNode('tenant-a', 'PROJECT', 'p1', 'A1');
      await kg.upsertNode('tenant-b', 'PROJECT', 'p1', 'B1');
      const rows = await prisma.knowledgeNode.findMany({ orderBy: { id: 'asc' } });
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.tenantId).sort()).toEqual(['tenant-a', 'tenant-b']);
    });
  });

  describe('KnowledgeGraph.searchNodes / findNode', () => {
    beforeEach(async () => {
      await kg.upsertNode('tenant-a', 'PROJECT', 'p1', 'Marketing Campaign');
      await kg.upsertNode('tenant-a', 'PROJECT', 'p2', 'Finance Review');
      await kg.upsertNode('tenant-b', 'PROJECT', 'p3', 'Marketing Audit');
    });

    it('searchNodes is case-insensitive on label', async () => {
      const r = await kg.searchNodes('tenant-a', 'marketing');
      expect(r.length).toBeGreaterThanOrEqual(1);
      expect(r.map((n) => n.label)).toContain('Marketing Campaign');
    });

    it('searchNodes does not leak across tenants', async () => {
      const r = await kg.searchNodes('tenant-a', 'Marketing');
      expect(r.every((n) => n.tenantId === 'tenant-a')).toBe(true);
      expect(r.some((n) => n.label === 'Marketing Audit')).toBe(false); // tenant-b
    });

    it('findNode returns null cross-tenant', async () => {
      expect(await kg.findNode('tenant-a', 'PROJECT', 'p3')).toBeNull();
    });
  });

  describe('KnowledgeGraph.health (audit-remediation: parameterized Prisma.sql)', () => {
    it('reports zero orphan nodes when edges are complete', async () => {
      const a = await kg.upsertNode('tenant-a', 'PROJECT', 'p1', 'P1');
      const b = await kg.upsertNode('tenant-a', 'CUSTOMER', 'c1', 'C1');
      await kg.upsertEdge('tenant-a', a.id, b.id, 'RELATED_TO', [{ source: 'CONTEXT_PLANE', reference: 'projects', detail: 'r' }]);
      const h = await kg.health('tenant-a');
      expect(h.nodeCount).toBe(2);
      expect(h.edgeCount).toBe(1);
      expect(h.orphanNodes).toBe(0);
      expect(h.consistencyGrade).toBe('EXCELLENT');
    });

    it('reports one orphan node for an isolated node (edge count = 0)', async () => {
      await kg.upsertNode('tenant-a', 'PROJECT', 'p1', 'P1');
      const h = await kg.health('tenant-a');
      expect(h.orphanNodes).toBe(1);
      expect(h.consistencyGrade).toBe('GOOD'); // not EXCELLENT when orphans > 0
    });

    it('health does not crash on malicious tenantId characters (audit-remediation)', async () => {
      // The previous raw-string `WHERE n."tenantId" = '${tenantId}'` would
      // throw on a quoted input. The parameterized Prisma.sql binds the
      // value safely; a malicious string with quotes or backslashes must
      // not raise a SQL syntax error.
      const malicious = "tenant'evil\\"; // contains the characters that
        // would have hit the prior string-interpolation path.
      const h = await kg.health(malicious);
      expect(h.nodeCount).toBe(0);
      expect(h.edgeCount).toBe(0);
    });
  });

  describe('OntologyManager.evolve persists version + latest currentVersion', () => {
    it('evolve(); currentVersion() returns the new max version', async () => {
      const cur0 = await om.currentVersion('tenant-a');
      await om.evolve('tenant-a', { version: cur0.version + 1, entities: [], relationships: [] });
      const cur1 = await om.currentVersion('tenant-a');
      expect(cur1.version).toBe(cur0.version + 1);
    });
  });
});
