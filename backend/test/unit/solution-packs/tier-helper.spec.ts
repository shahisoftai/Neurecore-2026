import { tierMeetsPackRequirement } from '../../../src/modules/solution-packs/interfaces/solution-pack.interface';

/**
 * Unit tests for the tier-meets-requirement helper used by both
 * `PackValidator` and `TiersService.canInstallPack()`. Phase 7, Task 7.11.
 */

describe('tierMeetsPackRequirement', () => {
  it('returns true when tenant tier == required tier', () => {
    expect(tierMeetsPackRequirement('PRO', 'PRO')).toBe(true);
    expect(tierMeetsPackRequirement('COMMUNITY', 'COMMUNITY')).toBe(true);
  });

  it('returns true when tenant tier > required tier', () => {
    expect(tierMeetsPackRequirement('ENTERPRISE', 'PRO')).toBe(true);
    expect(tierMeetsPackRequirement('PRO', 'STARTER')).toBe(true);
    expect(tierMeetsPackRequirement('STARTER', 'COMMUNITY')).toBe(true);
  });

  it('returns false when tenant tier < required tier', () => {
    expect(tierMeetsPackRequirement('STARTER', 'PRO')).toBe(false);
    expect(tierMeetsPackRequirement('PRO', 'ENTERPRISE')).toBe(false);
    expect(tierMeetsPackRequirement('COMMUNITY', 'STARTER')).toBe(false);
  });

  it('returns false for unknown tiers', () => {
    // @ts-expect-error: unknown tier value
    expect(tierMeetsPackRequirement('MYSTERY', 'PRO')).toBe(false);
    // @ts-expect-error: unknown tier value
    expect(tierMeetsPackRequirement('PRO', 'MYSTERY')).toBe(false);
  });
});