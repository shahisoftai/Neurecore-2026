import { ChunkingService } from '../../src/modules/knowledge/services/chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(() => {
    service = new ChunkingService();
  });

  it('returns an empty array for empty / whitespace input', () => {
    expect(service.split('')).toEqual([]);
    expect(service.split('   \n\n  ')).toEqual([]);
  });

  it('produces a single chunk when text fits in maxChunkChars', () => {
    const text = 'Short paragraph. Another sentence.';
    const chunks = service.split(text, { maxChunkChars: 500, overlapChars: 0 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].text).toContain('Short paragraph');
  });

  it('splits long text into multiple chunks', () => {
    const longText = Array.from(
      { length: 30 },
      (_, i) => `Paragraph ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
    ).join('\n\n');

    const chunks = service.split(longText, {
      maxChunkChars: 200,
      overlapChars: 0,
    });
    expect(chunks.length).toBeGreaterThan(5);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('every chunk has a positive tokenEstimate', () => {
    const text = 'Some text. More text. And more.';
    service.split(text).forEach((c) => {
      expect(c.tokenEstimate).toBeGreaterThan(0);
      expect(c.text.length).toBeGreaterThan(0);
    });
  });

  it('applies overlap so consecutive chunks share trailing/leading chars', () => {
    const text = Array.from(
      { length: 8 },
      (_, i) => `Section ${i}: content here is long enough to not get merged into a tiny sliver.`,
    ).join('\n\n');

    const chunks = service.split(text, {
      maxChunkChars: 300,
      overlapChars: 40,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // First chars of chunk[1] should overlap with tail of chunk[0]
    const overlap = chunks[1].text.slice(0, 40);
    expect(chunks[0].text).toContain(overlap.slice(-20));
  });

  it('does not produce chunks larger than maxChunkChars (no overlap)', () => {
    const text = 'word '.repeat(2_000); // 10_000 chars
    const max = 250;
    const chunks = service.split(text, { maxChunkChars: max, overlapChars: 0 });
    chunks.forEach((c) => {
      // With no overlap the chunker hard-cuts at `max`.
      expect(c.text.length).toBeLessThanOrEqual(max);
    });
  });

  it('hard-cuts even when no natural separators exist', () => {
    const text = 'word '.repeat(2_000); // 10_000 chars
    const max = 250;
    const chunks = service.split(text, { maxChunkChars: max, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(10); // 10_000 / 250 = 40 chunks
    expect(chunks.length).toBeLessThanOrEqual(50);
  });
});