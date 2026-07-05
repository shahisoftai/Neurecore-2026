/**
 * HermesMemoryService unit tests — H7 (vector embedding population).
 */

import { HermesMemoryService } from '../../src/modules/hermes/services/hermes-memory.service';

function makePrisma() {
  return {
    hermesMemoryEntry: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'm1', ...data }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as never;
}

describe('HermesMemoryService.store (H7 embedding)', () => {
  it('populates embedding column when EmbeddingsService returns a vector', async () => {
    const prisma = makePrisma();
    const embeddings = { embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]) };
    const svc = new HermesMemoryService(prisma, embeddings as never);
    await svc.store({
      hermesAgentId: 'h1',
      tenantId: 't1',
      type: 'EPISODIC',
      content: 'agent did the thing',
    });
    expect(embeddings.embedQuery).toHaveBeenCalledWith('agent did the thing');
    expect(prisma.hermesMemoryEntry.create).toHaveBeenCalledTimes(1);
    const data = (prisma.hermesMemoryEntry.create as jest.Mock).mock.calls[0][0].data;
    expect(data.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('skips embedding when EmbeddingsService is not wired', async () => {
    const prisma = makePrisma();
    const svc = new HermesMemoryService(prisma);
    await svc.store({
      hermesAgentId: 'h1',
      tenantId: 't1',
      type: 'EPISODIC',
      content: 'no embeddings here',
    });
    const data = (prisma.hermesMemoryEntry.create as jest.Mock).mock.calls[0][0].data;
    expect(data.embedding).toEqual([]);
  });

  it('tolerates EmbeddingsService returning null (e.g. OPENAI_API_KEY missing)', async () => {
    const prisma = makePrisma();
    const embeddings = { embedQuery: jest.fn().mockResolvedValue(null) };
    const svc = new HermesMemoryService(prisma, embeddings as never);
    await svc.store({
      hermesAgentId: 'h1',
      tenantId: 't1',
      type: 'EPISODIC',
      content: 'embedding unavailable',
    });
    const data = (prisma.hermesMemoryEntry.create as jest.Mock).mock.calls[0][0].data;
    expect(data.embedding).toEqual([]);
  });

  it('tolerates EmbeddingsService throwing — logs WARN, stores without vector', async () => {
    const prisma = makePrisma();
    const embeddings = {
      embedQuery: jest.fn().mockRejectedValue(new Error('rate limited')),
    };
    const svc = new HermesMemoryService(prisma, embeddings as never);
    await svc.store({
      hermesAgentId: 'h1',
      tenantId: 't1',
      type: 'EPISODIC',
      content: 'embedding blew up',
    });
    const data = (prisma.hermesMemoryEntry.create as jest.Mock).mock.calls[0][0].data;
    expect(data.embedding).toEqual([]);
  });
});

describe('HermesMemoryService.getContext', () => {
  it('returns empty string when no entries', async () => {
    const prisma = makePrisma();
    const svc = new HermesMemoryService(prisma);
    const out = await svc.getContext('h1', 't1');
    expect(out).toBe('');
  });

  it('formats entries with importance marker', async () => {
    const prisma = {
      hermesMemoryEntry: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { type: 'EPISODIC', content: 'long content…', summary: 'summary A', importance: 0.9 },
          { type: 'PERSONAL', content: 'short', summary: null, importance: 0.4 },
        ]),
      },
    } as never;
    const svc = new HermesMemoryService(prisma);
    const out = await svc.getContext('h1', 't1');
    expect(out).toContain('[EPISODIC (important)]: summary A');
    expect(out).toContain('[PERSONAL]: short');
  });
});