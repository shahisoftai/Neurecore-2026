/**
 * Capabilities — invariant checks
 */

import {
  ALL_FALLBACK_CHAINS,
  CAPABILITIES,
  isCapability,
} from './capabilities';

describe('capabilities', () => {
  it('exposes the locked capability set', () => {
    expect(CAPABILITIES).toEqual([
      'planning',
      'execution',
      'reasoning',
      'conversation',
      'coding',
      'tools',
      'evaluation',
      'embedding',
    ]);
  });

  it('has a fallback chain for every capability', () => {
    for (const cap of CAPABILITIES) {
      expect(ALL_FALLBACK_CHAINS[cap]).toBeDefined();
      expect(ALL_FALLBACK_CHAINS[cap].length).toBeGreaterThan(0);
    }
  });

  it('isCapability narrows correctly', () => {
    expect(isCapability('planning')).toBe(true);
    expect(isCapability('unknown')).toBe(false);
    expect(isCapability(42)).toBe(false);
  });
});
