/**
 * appliesWhen.spec.ts — Phase 2B unit tests
 *
 * Covers §3.4 semantics. 8 cases minimum.
 */

import { evaluateAppliesWhen, filterByAppliesWhen } from './appliesWhen';

describe('evaluateAppliesWhen', () => {
  it('returns true when rule is undefined (default in-scope)', () => {
    expect(evaluateAppliesWhen(undefined, {})).toBe(true);
  });

  it('returns true when rule is empty object', () => {
    expect(evaluateAppliesWhen({}, {})).toBe(true);
  });

  it('hasCustomer:true requires ctx.hasCustomer=true', () => {
    expect(
      evaluateAppliesWhen({ hasCustomer: true }, { hasCustomer: true }),
    ).toBe(true);
    expect(
      evaluateAppliesWhen({ hasCustomer: true }, { hasCustomer: false }),
    ).toBe(false);
    expect(evaluateAppliesWhen({ hasCustomer: true }, {})).toBe(false);
  });

  it('hasCustomer:false requires ctx.hasCustomer=false (or unset)', () => {
    expect(
      evaluateAppliesWhen({ hasCustomer: false }, { hasCustomer: false }),
    ).toBe(true);
    expect(
      evaluateAppliesWhen({ hasCustomer: false }, { hasCustomer: true }),
    ).toBe(false);
  });

  it('classification list requires ctx.classification ∈ list', () => {
    expect(
      evaluateAppliesWhen(
        { classification: ['CLIENT_ENGAGEMENT', 'INTERNAL_INITIATIVE'] },
        { classification: 'CLIENT_ENGAGEMENT' },
      ),
    ).toBe(true);
    expect(
      evaluateAppliesWhen(
        { classification: ['CLIENT_ENGAGEMENT'] },
        { classification: 'OPERATIONAL_PROGRAM' },
      ),
    ).toBe(false);
    expect(
      evaluateAppliesWhen({ classification: ['CLIENT_ENGAGEMENT'] }, {}),
    ).toBe(false);
  });

  it('multiple rules AND together — all must pass', () => {
    const rule = {
      hasCustomer: true,
      classification: ['CLIENT_ENGAGEMENT' as const],
    };
    expect(
      evaluateAppliesWhen(rule, {
        hasCustomer: true,
        classification: 'CLIENT_ENGAGEMENT',
      }),
    ).toBe(true);
    expect(
      evaluateAppliesWhen(rule, {
        hasCustomer: false,
        classification: 'CLIENT_ENGAGEMENT',
      }),
    ).toBe(false);
  });

  it('empty classification array is treated as no rule', () => {
    expect(
      evaluateAppliesWhen(
        { classification: [] },
        { classification: 'CLIENT_ENGAGEMENT' },
      ),
    ).toBe(true);
  });

  it('handles null classification gracefully', () => {
    expect(
      evaluateAppliesWhen(
        { classification: ['CLIENT_ENGAGEMENT'] },
        { classification: null },
      ),
    ).toBe(false);
  });
});

describe('filterByAppliesWhen', () => {
  it('keeps items with no appliesWhen', () => {
    const items = [
      { id: 'a' },
      { id: 'b', appliesWhen: { hasCustomer: true } },
    ];
    expect(filterByAppliesWhen(items, { hasCustomer: false })).toEqual([
      { id: 'a' },
    ]);
  });

  it('keeps items that pass the rule', () => {
    const items = [
      { id: 'a', appliesWhen: { hasCustomer: true } },
      { id: 'b', appliesWhen: { hasCustomer: false } },
    ];
    expect(filterByAppliesWhen(items, { hasCustomer: true })).toEqual([
      { id: 'a', appliesWhen: { hasCustomer: true } },
    ]);
  });
});
