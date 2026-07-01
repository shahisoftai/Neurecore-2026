import { HybridSearchService } from '../../src/modules/knowledge/services/hybrid-search.service';

interface PrismaStub {
  knowledgeEntry: {
    findMany: jest.Mock;
  };
  $queryRawUnsafe: jest.Mock;
}

function makePrisma(entries: any[] = [], queryResult: any[] = []): PrismaStub {
  return {
    knowledgeEntry: {
      findMany: jest.fn().mockResolvedValue(entries),
    },
    $queryRawUnsafe: jest.fn().mockResolvedValue(queryResult),
  };
}

describe('HybridSearchService — basic contract', () => {
  let service: HybridSearchService;
  let prisma: PrismaStub;

  beforeEach(() => {
    prisma = makePrisma();
    service = new HybridSearchService(prisma as never);
  });

  it('returns [] when query has no tokens', async () => {
    const result = await service.search({
      tenantId: 't1',
      query: '   !!! ??? ',
      topK: 5,
    });
    expect(result).toEqual([]);
  });

  it('returns [] when no candidate rows match', async () => {
    const result = await service.search({
      tenantId: 't1',
      query: 'sales methodology',
      topK: 5,
    });
    expect(result).toEqual([]);
  });

  it('blends BM25 rank into a [0, 1] score when only BM25 hits exist', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      { id: 'a', rank: 0.6, content: 'Sales methodology for Q3.' },
      { id: 'b', rank: 0.4, content: 'Other content here.' },
    ]);
    prisma.knowledgeEntry.findMany.mockResolvedValueOnce([
      {
        id: 'a',
        tenantId: 't1',
        title: 'Q3 Sales',
        type: 'POLICY',
        content: 'Sales methodology for Q3.',
        tags: ['sales'],
        departmentId: null,
      },
      {
        id: 'b',
        tenantId: 't1',
        title: 'Other',
        type: 'GUIDE',
        content: 'Other content here.',
        tags: [],
        departmentId: null,
      },
    ]);

    const result = await service.search({
      tenantId: 't1',
      query: 'sales methodology',
      topK: 5,
      vectorWeight: 0.7,
    });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    // Scores should be in [0, 1] (rescaled since no vector hits)
    result.forEach((r) => {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    });
  });

  it('falls back to ILIKE when tsvector query throws', async () => {
    prisma.$queryRawUnsafe.mockRejectedValueOnce(new Error('tsvector offline'));
    // The ILIKE fallback calls findMany; the outer search() then calls findMany
    // again to reconcile candidate rows. Mock both.
    prisma.knowledgeEntry.findMany
      .mockResolvedValueOnce([
        {
          id: 'a',
          tenantId: 't1',
          title: 'Sales',
          type: 'POLICY',
          content: 'sales methodology is great',
          tags: [],
          departmentId: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'a',
          tenantId: 't1',
          title: 'Sales',
          type: 'POLICY',
          content: 'sales methodology is great',
          tags: [],
          departmentId: null,
        },
      ]);

    const result = await service.search({
      tenantId: 't1',
      query: 'sales methodology',
      topK: 5,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('extracts highlights around matched tokens', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        id: 'a',
        rank: 0.5,
        content: 'This is a long paragraph that discusses the sales methodology for Q3.',
      },
    ]);
    prisma.knowledgeEntry.findMany.mockResolvedValueOnce([
      {
        id: 'a',
        tenantId: 't1',
        title: 'Q3',
        type: 'POLICY',
        content: 'This is a long paragraph that discusses the sales methodology for Q3.',
        tags: [],
        departmentId: null,
      },
    ]);

    const result = await service.search({
      tenantId: 't1',
      query: 'sales',
      topK: 5,
    });
    expect(result[0].highlights.length).toBeGreaterThan(0);
    expect(result[0].highlights[0].toLowerCase()).toContain('sales');
  });
});