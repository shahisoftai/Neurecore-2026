// ─── BraceBalancedJsonExtractor.test.ts ────────────────────────────────────────
// Verifies the JSON extractor handles nested braces, strings, and edge cases.

import { describe, expect, it } from 'vitest';
import { BraceBalancedJsonExtractor } from '@/core/services/chat/fallback/BraceBalancedJsonExtractor';

const extractor = new BraceBalancedJsonExtractor();

describe('BraceBalancedJsonExtractor', () => {
  it('returns null when no braces present', () => {
    expect(extractor.extract('plain text reply')).toBeNull();
  });

  it('returns null when braces present but no chartType', () => {
    const text = 'reply with {"unrelated":"data"} inside';
    expect(extractor.extract(text)).toBeNull();
  });

  it('extracts chart JSON block and strips it from reply', () => {
    const text = 'Here is the chart. {"chartType":"bar","chartData":[{"label":"A","value":1}]}';
    const result = extractor.extract(text);
    expect(result).not.toBeNull();
    expect(result?.cleaned).toBe('Here is the chart.');
    expect(result?.chartType).toBe('bar');
    expect(result?.chartData).toEqual([{ label: 'A', value: 1 }]);
  });

  it('handles braces inside JSON strings', () => {
    const text = 'Title {"chartType":"bar","chartData":[{"label":"X {y}","value":2}]} end';
    const result = extractor.extract(text);
    expect(result).not.toBeNull();
    expect(result?.chartData).toEqual([{ label: 'X {y}', value: 2 }]);
  });

  it('handles nested objects', () => {
    const text = '{"chartType":"bar","chartData":[{"label":"A","meta":{"nested":true},"value":5}]}';
    const result = extractor.extract(text);
    expect(result).not.toBeNull();
    expect(result?.chartData).toEqual([
      { label: 'A', meta: { nested: true }, value: 5 },
    ]);
  });

  it('handles escaped quotes inside strings', () => {
    const text = '{"chartType":"bar","chartData":[{"label":"He said \\"hi\\"","value":1}]}';
    const result = extractor.extract(text);
    expect(result).not.toBeNull();
    expect((result?.chartData as Array<{ label: string }>)[0].label).toBe(
      'He said "hi"',
    );
  });

  it('returns null for invalid JSON even with chartType-shaped text', () => {
    const text = '{"chartType":"bar","chartData":[ INVALID';
    expect(extractor.extract(text)).toBeNull();
  });

  it('returns null when chartType is missing from parsed object', () => {
    const text = '{"chartData":[{"label":"A","value":1}]}';
    expect(extractor.extract(text)).toBeNull();
  });

  it('returns null when chartType is empty/falsy', () => {
    const text = '{"chartType":"","chartData":[{"label":"A","value":1}]}';
    expect(extractor.extract(text)).toBeNull();
  });
});
