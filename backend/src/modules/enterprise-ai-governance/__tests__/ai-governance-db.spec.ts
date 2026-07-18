/**
 * Enterprise AI Governance — REAL PostgreSQL integration tests.
 *
 * Companion to the in-memory P13 spec. Proves the SQL `where`
 * clauses enforce tenant isolation at the DB layer. GATED on
 * DATABASE_TEST_URL.
 *
 * Audit-remediation: the pre-fix `decideReview(id)` did
 * prisma.humanReviewRecord.update with `where: { id: reviewId }` —
 * missing tenantId. The gated DB tests prove the compound (id,
 * tenantId) where clause is enforced at the SQL layer.
 */

import { PrismaClient } from '@prisma/client';
import { AIGovernancePlatform } from '../ai-governance.service';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('AIGovernancePlatform — REAL PostgreSQL (DATABASE_TEST_URL)', () => {
  let prisma: PrismaClient;
  let gov: AIGovernancePlatform;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        ai_human_reviews, ai_model_registry, ai_policies, ai_bias_findings,
        ai_hallucination_flags, trust_evaluations
      RESTART IDENTITY CASCADE
    `);
    gov = new AIGovernancePlatform(prisma as any, { publish: async () => {} } as any);
  });

  afterAll(async () => { await prisma.$disconnect(); });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        ai_human_reviews, ai_model_registry, ai_policies, ai_bias_findings,
        ai_hallucination_flags, trust_evaluations
      RESTART IDENTITY CASCADE
    `);
  });

  describe('Trust evaluation persistence', () => {
    it('persists with the caller tenantId and the categorical grades', async () => {
      const r = await gov.evaluate('cognize', 'task-1', 'tenant-a', { a: 1, b: 2, c: 3 }, 'twenty-five chars reasoning here');
      const row = await prisma.trustEvaluation.findFirst({ where: { id: r.id } });
      expect(row?.tenantId).toBe('tenant-a');
      expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL']).toContain(row?.trustScore);
      expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL']).toContain(row?.evidenceQuality);
      expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL']).toContain(row?.reasoningQuality);
    });

    it('listTrustEvaluations filters by sourceType when provided', async () => {
      await gov.evaluate('cognize', 'task-1', 'tenant-a', { a: 1 }, 'ten chars +');
      await gov.evaluate('recommendation', 'r-1', 'tenant-a', { a: 1 }, 'ten chars +');
      const rows = await gov.listTrustEvaluations('tenant-a', 'cognize');
      expect(rows).toHaveLength(1);
      expect(rows[0].sourceType).toBe('cognize');
    });
  });

  describe('Hallucination / Bias persistence', () => {
    it('flagHallucination persists with the caller tenantId', async () => {
      await gov.flagHallucination('tenant-a', 'cognize', 'task-1', 'claim', 'evidence gap', 'POOR');
      const row = await prisma.aIHallucinationFlag.findFirst({ where: { tenantId: 'tenant-a' } });
      expect(row?.severity).toBe('POOR');
    });

    it('recordBias persists with the caller tenantId', async () => {
      await gov.recordBias('tenant-a', 'REPRESENTATION', 'detail', 'FAIR');
      const row = await prisma.aIBiasFinding.findFirst({ where: { tenantId: 'tenant-a' } });
      expect(row?.severity).toBe('FAIR');
      expect(row?.category).toBe('REPRESENTATION');
    });
  });

  describe('Policy and Model persistence', () => {
    it('createPolicy persists with the caller tenantId and @@unique([tenantId, name, version]) enforces uniqueness', async () => {
      await gov.createPolicy('tenant-a', 'Policy', 'EVIDENCE');
      // Same name+version under another tenant should ALLOW it (tenant-scope uniqueness).
      const v2 = await gov.createPolicy('tenant-b', 'Policy', 'EVIDENCE');
      expect(v2.id).toBeDefined();
      // Same name under same tenant throws because of unique violation.
      await expect(gov.createPolicy('tenant-a', 'Policy', 'EVIDENCE')).rejects.toBeDefined();
    });

    it('registerModel upsert updates rather than duplicating on (tenantId, modelName)', async () => {
      await gov.registerModel('tenant-a', 'GPT-4o', 'OpenAI', ['reasoning']);
      await gov.registerModel('tenant-a', 'GPT-4o', 'OpenAI', ['reasoning', 'translation']);
      const rows = await prisma.modelRegistration.findMany({ where: { tenantId: 'tenant-a' } });
      expect(rows).toHaveLength(1);
      expect(rows[0].capabilities).toEqual(['reasoning', 'translation']);
    });
  });

  describe('decideReview (audit-remediation: cross-tenant refusal)', () => {
    it('CRITICAL: decideReview refuses a cross-tenant reviewId at the SQL layer', async () => {
      const r = await gov.createReview('tenant-a', 'cognize', 'task-1');
      await expect(gov.decideReview('tenant-b', r.id, 'APPROVED', 'reviewer-x')).rejects.toThrow(/not found for tenant/);
      // Tenant A's review must be unchanged.
      const row = await prisma.humanReviewRecord.findFirst({ where: { id: r.id } });
      expect(row?.decision).toBe('NEEDS_REVISION');
      expect(row?.reviewedAt).toBeNull();
    });

    it('decideReview succeeds for the owning tenant and persists decision + reviewer + reviewedAt', async () => {
      const r = await gov.createReview('tenant-a', 'cognize', 'task-1');
      await gov.decideReview('tenant-a', r.id, 'APPROVED', 'reviewer-1', 'ok');
      const row = await prisma.humanReviewRecord.findFirst({ where: { id: r.id } });
      expect(row?.decision).toBe('APPROVED');
      expect(row?.reviewerId).toBe('reviewer-1');
      expect(row?.reason).toBe('ok');
      expect(row?.reviewedAt).not.toBeNull();
    });

    it('decideReview throws when the reviewId doesn\'t exist', async () => {
      await expect(gov.decideReview('tenant-a', 'missing', 'APPROVED', 'r')).rejects.toThrow(/not found for tenant/);
    });
  });

  describe('Dashboard tenant-scoped counts', () => {
    it('persists and aggregates per tenant', async () => {
      await gov.evaluate('cognize', 'task-1', 'tenant-a', { a: 1 }, 'ten chars +');
      await gov.flagHallucination('tenant-a', 'cognize', 'task-1', 'c', 'g');
      await gov.recordBias('tenant-a', 'R', 'd');
      await gov.createPolicy('tenant-a', 'P', 'EVIDENCE');
      await gov.registerModel('tenant-a', 'M1', 'OpenAI');
      await gov.createReview('tenant-a', 'cognize', 'task-1');

      const d = await gov.dashboard('tenant-a');
      expect(d.trustEvals).toBe(1);
      expect(d.hallucinations).toBe(1);
      expect(d.biasFindings).toBe(1);
      expect(d.policies).toBe(1);
      expect(d.models).toBe(1);
      expect(d.pendingReviews).toBe(1);
    });

    it('does not leak other tenants\' counts at the SQL layer', async () => {
      await gov.evaluate('cognize', 'task-1', 'tenant-a', { a: 1 }, 'ten chars +');
      await gov.evaluate('cognize', 'task-1', 'tenant-b', { a: 1 }, 'ten chars +');
      const dA = await gov.dashboard('tenant-a');
      const dB = await gov.dashboard('tenant-b');
      expect(dA.trustEvals).toBe(1);
      expect(dB.trustEvals).toBe(1);
    });
  });
});
