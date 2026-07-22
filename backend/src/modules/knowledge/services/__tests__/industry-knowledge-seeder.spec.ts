/**
 * Phase 7 G1 — IndustryKnowledgeSeeder tests.
 *
 * Validates the seeder's SRP-correct behaviour: clones industry corpus
 * rows to a tenant, idempotent on re-run, and no-op for unknown
 * industries.
 */

import { IndustryKnowledgeSeeder, KNOWLEDGE_CORPUS } from '../industry-knowledge-seeder.service';

describe('IndustryKnowledgeSeeder', () => {
  let seeder: IndustryKnowledgeSeeder;
  let prismaMock: {
    knowledgeEntry: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      knowledgeEntry: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    seeder = new IndustryKnowledgeSeeder(prismaMock as never);
  });

  describe('seedForTenant', () => {
    it('clones every corpus entry for a known industry', async () => {
      prismaMock.knowledgeEntry.findFirst.mockResolvedValue(null);
      prismaMock.knowledgeEntry.create.mockResolvedValue({});

      const created = await seeder.seedForTenant('t1', 'financial-compliance');

      const corpusSize = KNOWLEDGE_CORPUS['financial-compliance']?.length ?? 0;
      expect(corpusSize).toBeGreaterThan(0);
      expect(created).toBe(corpusSize);
      expect(prismaMock.knowledgeEntry.create).toHaveBeenCalledTimes(corpusSize);
    });

    it('persists the correct tenantId + system-corpus source + visibility=TENANT', async () => {
      prismaMock.knowledgeEntry.findFirst.mockResolvedValue(null);
      prismaMock.knowledgeEntry.create.mockResolvedValue({});

      await seeder.seedForTenant('tenant-XYZ', 'financial-compliance');

      const firstCall = prismaMock.knowledgeEntry.create.mock.calls[0][0];
      expect(firstCall.data.tenantId).toBe('tenant-XYZ');
      expect(firstCall.data.source).toBe('system-corpus');
      expect(firstCall.data.visibilityScope).toBe('TENANT');
      expect(firstCall.data.status).toBe('published');
    });

    it('skips entries that already exist (idempotent)', async () => {
      // First entry exists, second does not.
      prismaMock.knowledgeEntry.findFirst
        .mockResolvedValueOnce({ id: 'existing-1' }) // exists — skip
        .mockResolvedValueOnce(null); // doesn't exist — create
      prismaMock.knowledgeEntry.create.mockResolvedValue({});

      const corpusSize = KNOWLEDGE_CORPUS['financial-compliance']?.length ?? 0;
      const created = await seeder.seedForTenant('t1', 'financial-compliance');

      expect(created).toBe(corpusSize - 1);
      expect(prismaMock.knowledgeEntry.create).toHaveBeenCalledTimes(corpusSize - 1);
    });

    it('returns 0 and creates nothing for an unknown industry', async () => {
      const created = await seeder.seedForTenant('t1', 'unknown-industry');
      expect(created).toBe(0);
      expect(prismaMock.knowledgeEntry.create).not.toHaveBeenCalled();
    });

    it('is a no-op when prisma is not injected (test environment guard)', async () => {
      const noDbSeeder = new IndustryKnowledgeSeeder(undefined);
      const created = await noDbSeeder.seedForTenant('t1', 'financial-compliance');
      expect(created).toBe(0);
    });
  });

  describe('helper accessors', () => {
    it('listIndustriesWithCorpus returns at least financial-compliance', () => {
      const industries = seeder.listIndustriesWithCorpus();
      expect(industries).toContain('financial-compliance');
    });

    it('corpusSizeFor returns the right count', () => {
      const size = seeder.corpusSizeFor('financial-compliance');
      expect(size).toBe(KNOWLEDGE_CORPUS['financial-compliance'].length);
      expect(size).toBeGreaterThan(0);
    });

    it('corpusSizeFor returns 0 for unknown industries', () => {
      expect(seeder.corpusSizeFor('nope')).toBe(0);
    });
  });

  describe('contentVector invariant (Phase 7 G1 SRP)', () => {
    it('does not include contentVector in the typed create payload (PgVector-friendly)', async () => {
      // Phase 7 G1 SRP guard — the seeder writes content as plain text
      // (contentVector stays NULL). Production tenants run a one-shot
      // backfill via PgVectorStore.upsert() to populate vectors.
      prismaMock.knowledgeEntry.findFirst.mockResolvedValue(null);
      prismaMock.knowledgeEntry.create.mockResolvedValue({});

      await seeder.seedForTenant('t1', 'financial-compliance');

      const firstCall = prismaMock.knowledgeEntry.create.mock.calls[0][0];
      expect(firstCall.data).not.toHaveProperty('contentVector');
    });
  });
});
