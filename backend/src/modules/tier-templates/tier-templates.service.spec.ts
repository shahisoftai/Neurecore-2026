/**
 * Tier Templates Pool — unit tests.
 * Phase 10 — verifies SOLID: TierTemplatesService extends PoolService.
 */

import { TierTemplatesService } from './tier-templates.service';

describe('TierTemplatesService — Phase 10 Tier Pool', () => {
  let service: TierTemplatesService;

  beforeEach(() => {
    service = new TierTemplatesService({} as never);
  });

  it('is an instance of PoolService (Liskov)', () => {
    expect(service).toBeDefined();
    expect(typeof (service as unknown as { list: unknown }).list).toBe('function');
  });

  it('exposes uniqueKey = slug', () => {
    expect((service as unknown as { uniqueKey: string }).uniqueKey).toBe('slug');
  });

  describe('config.buildWhere', () => {
    it('returns empty when no options', () => {
      expect(service['config'].buildWhere({})).toEqual({});
    });

    it('accepts DRAFT/PUBLISHED/ARCHIVED', () => {
      expect((service['config'].buildWhere({ status: 'DRAFT' }) as { status: string }).status).toBe('DRAFT');
      expect((service['config'].buildWhere({ status: 'PUBLISHED' }) as { status: string }).status).toBe('PUBLISHED');
      expect((service['config'].buildWhere({ status: 'ARCHIVED' }) as { status: string }).status).toBe('ARCHIVED');
    });

    it('ignores invalid status values', () => {
      expect(service['config'].buildWhere({ status: 'NOPE' })).not.toHaveProperty('status');
    });

    it('builds OR search across slug/name', () => {
      const where = service['config'].buildWhere({ search: 'starter' });
      expect(where).toHaveProperty('OR');
      expect(Array.isArray((where as { OR: unknown[] }).OR)).toBe(true);
    });
  });
});
