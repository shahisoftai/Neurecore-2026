import { EmbeddingsService } from '../../src/modules/knowledge/services/embeddings.service';

describe('EmbeddingsService (no API key — graceful fallback)', () => {
  let service: EmbeddingsService;

  beforeEach(() => {
    const config = {
      get: (key: string) => (key === 'OPENAI_API_KEY' ? undefined : undefined),
    };
    service = new EmbeddingsService(config as never);
  });

  it('reports 1536 dimensions by default', () => {
    expect(service.dimensions).toBe(1536);
  });

  it('returns null when no API key is configured', async () => {
    const vec = await service.embedQuery('hello world');
    expect(vec).toBeNull();
  });

  it('returns nulls for embedDocuments when no API key', async () => {
    const res = await service.embedDocuments(['a', 'b']);
    expect(res).toEqual([null, null]);
  });

  it('returns null for empty/whitespace input', async () => {
    expect(await service.embedQuery('')).toBeNull();
    expect(await service.embedQuery('   ')).toBeNull();
  });
});

describe('EmbeddingsService (cache)', () => {
  it('caches results across calls when API key is present (mocked)', async () => {
    const cache = new Map<string, number[]>();
    const config = {
      get: (key: string) => (key === 'OPENAI_API_KEY' ? 'sk-fake' : undefined),
    };
    const service = new EmbeddingsService(config as never);

    // Simulate a previous successful call by injecting into the cache.
    (service as unknown as { cache: Map<string, number[]> }).cache.set(
      'cached text',
      [0.1, 0.2, 0.3],
    );
    const v = await service.embedQuery('cached text');
    expect(v).toEqual([0.1, 0.2, 0.3]);
  });
});