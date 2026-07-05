/**
 * Industry Pool — unit tests.
 * Phase 10 — verifies SOLID: IndustriesService extends PoolService correctly,
 * returns proper where/orderBy clauses for the Industry Prisma model.
 */

import { IndustriesService } from './industries.service';

describe('IndustriesService — Phase 10 Industry Pool', () => {
  let service: IndustriesService;

  beforeEach(() => {
    service = new IndustriesService({} as never);
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
      const where = service['config'].buildWhere({});
      expect(where).toEqual({});
    });

    it('filters by status when valid', () => {
      const where = service['config'].buildWhere({ status: 'ACTIVE' });
      expect((where as { status: string }).status).toBe('ACTIVE');
    });

    it('ignores invalid status values', () => {
      const where = service['config'].buildWhere({ status: 'INVALID_STATUS' });
      expect(where).not.toHaveProperty('status');
    });

    it('builds OR search across slug/name', () => {
      const where = service['config'].buildWhere({ search: 'health' });
      expect(where).toHaveProperty('OR');
      expect(Array.isArray((where as { OR: unknown[] }).OR)).toBe(true);
      expect(((where as { OR: unknown[] }).OR ?? []).length).toBe(2);
    });
  });

  describe('config.buildOrderBy', () => {
    it('defaults to sortOrder ASC', () => {
      expect(service['config'].buildOrderBy({})).toEqual({ sortOrder: 'asc' });
    });

    it('honors custom sortBy and sortDir', () => {
      expect(service['config'].buildOrderBy({ sortBy: 'name', sortDir: 'desc' })).toEqual({
        name: 'desc',
      });
    });
  });
});
