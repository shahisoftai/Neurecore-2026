/**
 * Cost Calculator — pure function tests
 */

import { computeCostCents } from './cost-calculator';

describe('computeCostCents', () => {
  it('returns 0 for empty input', () => {
    expect(
      computeCostCents({
        provider: 'minimax',
        modelId: 'MiniMax-M2.7-highspeed',
        inputTokens: 0,
        outputTokens: 0,
        costPer1kInput: 0.0004,
        costPer1kOutput: 0.0008,
      }),
    ).toBe(0);
  });

  it('computes cost in cents with rounding', () => {
    // 1000 input @ $0.0004 + 500 output @ $0.0008 = $0.0004 + $0.0004 = $0.0008 = 0.08¢
    expect(
      computeCostCents({
        provider: 'minimax',
        modelId: 'MiniMax-M2.7-highspeed',
        inputTokens: 1000,
        outputTokens: 500,
        costPer1kInput: 0.0004,
        costPer1kOutput: 0.0008,
      }),
    ).toBeCloseTo(0.08, 5);
  });

  it('clamps negative results to 0', () => {
    expect(
      computeCostCents({
        provider: 'minimax',
        modelId: 'x',
        inputTokens: -5,
        outputTokens: 0,
        costPer1kInput: 0.0001,
        costPer1kOutput: 0,
      }),
    ).toBe(0);
  });
});
