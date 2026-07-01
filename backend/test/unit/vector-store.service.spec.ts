import { PgVectorStore } from '../../src/modules/knowledge/services/vector-store.service';

interface PrismaStub {
  $executeRawUnsafe: jest.Mock;
  $queryRawUnsafe: jest.Mock;
}

function makePrisma(): PrismaStub {
  return {
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  };
}

describe('PgVectorStore', () => {
  let prisma: PrismaStub;
  let store: PgVectorStore;

  beforeEach(() => {
    prisma = makePrisma();
    store = new PgVectorStore(prisma as never);
  });

  it('upsert issues a vector UPDATE', async () => {
    await store.upsert('id-1', [0.1, 0.2, 0.3]);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    const call = prisma.$executeRawUnsafe.mock.calls[0];
    expect(call[0]).toContain('UPDATE "knowledge_entries"');
    expect(call[0]).toContain('"contentVector" = $1::vector');
    expect(call[1]).toBe('[0.1,0.2,0.3]');
    expect(call[2]).toBe('id-1');
  });

  it('upsert skips on empty vector', async () => {
    await store.upsert('id-1', []);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('search orders by cosine distance and returns 1-distance', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      { id: 'a', score: 0.95 },
      { id: 'b', score: 0.81 },
    ]);
    const hits = await store.search([0.1, 0.2], 5);
    expect(hits).toEqual([
      { id: 'a', score: 0.95 },
      { id: 'b', score: 0.81 },
    ]);
    const sql = prisma.$queryRawUnsafe.mock.calls[0][0];
    expect(sql).toContain('1 - ("contentVector" <=> $1::vector)');
    expect(sql).toContain('LIMIT $2');
  });

  it('search returns [] for empty query vector', async () => {
    const hits = await store.search([], 5);
    expect(hits).toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('delete clears the vector column for one id', async () => {
    await store.delete('id-9');
    const call = prisma.$executeRawUnsafe.mock.calls[0];
    expect(call[0]).toContain('"contentVector" = NULL');
    expect(call[1]).toBe('id-9');
  });

  it('deleteMany clears vectors for many ids', async () => {
    await store.deleteMany(['a', 'b']);
    const call = prisma.$executeRawUnsafe.mock.calls[0];
    expect(call[0]).toContain('"id" = ANY($1::text[])');
    expect(call[1]).toEqual(['a', 'b']);
  });
});