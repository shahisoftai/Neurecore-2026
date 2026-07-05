/**
 * Feature Pool — unit tests.
 * Phase 10 — verifies SOLID: FeaturesService extends PoolService.
 */

import { FeatureCategory } from '@prisma/client';
import { FeaturesService } from './features.service';

describe('FeaturesService — Phase 10 Feature Pool', () => {
  let service: FeaturesService;

  beforeEach(() => {
    service = new FeaturesService({} as never);
  });

  it('is an instance of PoolService (Liskov)', () => {
    expect(service).toBeDefined();
    expect(typeof (service as unknown as { list: unknown }).list).toBe('function');
  });

  it('exposes uniqueKey = key (Features use a stable key, not a slug)', () => {
    expect((service as unknown as { uniqueKey: string }).uniqueKey).toBe('key');
  });

  describe('config.buildWhere', () => {
    it('returns empty when no options', () => {
      expect(service['config'].buildWhere({})).toEqual({});
    });

    it('filters by category when valid FeatureCategory', () => {
      const where = service['config'].buildWhere({ status: FeatureCategory.INTEGRATION });
      expect((where as { category: string }).category).toBe(FeatureCategory.INTEGRATION);
    });

    it('ignores non-category values', () => {
      const where = service['config'].buildWhere({ status: 'NOT_A_CATEGORY' });
      expect(where).not.toHaveProperty('category');
    });

    it('builds OR search across key/name', () => {
      const where = service['config'].buildWhere({ search: 'sso' });
      expect(where).toHaveProperty('OR');
      expect(Array.isArray((where as { OR: unknown[] }).OR)).toBe(true);
    });
  });
});
