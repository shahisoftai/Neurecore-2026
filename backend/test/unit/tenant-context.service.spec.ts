import { TenantContextService } from '../../src/common/context/tenant-context.service';
import { UserRole } from '@prisma/client';

/**
 * Unit tests for TenantContextService.
 *
 * Tests the ALS-backed request-scoped context:
 * - Context binding via run()
 * - tenantId / get() / getOrNull() accessors
 * - Error throwing outside context
 * - Async propagation through Promise chains
 * - Nested run() calls (inner wins)
 * - Context isolation between separate run() calls
 *
 * Phase 1E, Task 1.50.
 */

function makeContext(overrides: Partial<{
  tenantId: string;
  isCrossTenant: boolean;
  actorRole: UserRole;
  actorUserId: string;
}> = {}) {
  return {
    tenantId: 'tenant-test-1',
    isCrossTenant: false,
    actorRole: 'USER' as UserRole,
    actorUserId: 'user-abc',
    ...overrides,
  };
}

describe('TenantContextService', () => {
  let svc: TenantContextService;

  beforeEach(() => {
    svc = new TenantContextService();
  });

  // ─── Basic binding ──────────────────────────────────────────────────────────

  describe('run() + tenantId getter', () => {
    it('binds context and allows tenantId access inside run()', () => {
      const ctx = makeContext({ tenantId: 'tenant-xyz' });
      let captured: string;

      svc.run(ctx, () => {
        captured = svc.tenantId;
      });

      expect(captured).toBe('tenant-xyz');
    });

    it('binds full context and allows get() access inside run()', () => {
      const ctx = makeContext({ isCrossTenant: true, actorRole: 'SUPER_ADMIN' });
      let captured: string;

      svc.run(ctx, () => {
        captured = svc.get().tenantId;
      });

      expect(captured).toBe('tenant-test-1');
    });

    it('get() returns the full TenantContext', () => {
      const ctx = makeContext({ actorUserId: 'user-999', actorRole: 'ADMIN' });
      let captured: ReturnType<TenantContextService['get']>;

      svc.run(ctx, () => {
        captured = svc.get();
      });

      expect(captured).toMatchObject({
        tenantId: 'tenant-test-1',
        isCrossTenant: false,
        actorRole: 'ADMIN',
        actorUserId: 'user-999',
      });
    });
  });

  // ─── Outside-context behavior ───────────────────────────────────────────────

  describe('outside run() scope', () => {
    it('get() throws when called outside run()', () => {
      expect(() => svc.get()).toThrow(
        'TenantContext accessed outside a request scope',
      );
    });

    it('tenantId getter throws when called outside run()', () => {
      expect(() => svc.tenantId).toThrow(
        'TenantContext accessed outside a request scope',
      );
    });

    it('getOrNull() returns null outside run()', () => {
      expect(svc.getOrNull()).toBeNull();
    });
  });

  // ─── Async propagation ───────────────────────────────────────────────────────

  describe('async propagation', () => {
    it('context is available inside async functions within run()', async () => {
      const ctx = makeContext({ tenantId: 'tenant-async' });
      let captured: string;

      await svc.run(ctx, async () => {
        captured = await Promise.resolve(svc.tenantId);
      });

      expect(captured).toBe('tenant-async');
    });

    it('context propagates through Promise.then() chains', async () => {
      const ctx = makeContext({ tenantId: 'tenant-chain' });
      let captured: string;

      await svc.run(ctx, async () => {
        captured = await Promise.resolve('ignored')
          .then(() => svc.tenantId)
          .then((id) => id);
      });

      expect(captured).toBe('tenant-chain');
    });

    it('context propagates through nested async calls', async () => {
      const ctx = makeContext({ tenantId: 'tenant-nested-async' });
      let captured: string;

      async function deepAsync() {
        return svc.tenantId;
      }

      await svc.run(ctx, async () => {
        const result = await deepAsync();
        captured = result;
      });

      expect(captured).toBe('tenant-nested-async');
    });

    it('setTimeout callback retains context inside run()', async () => {
      const ctx = makeContext({ tenantId: 'tenant-timeout' });
      let captured: string;

      await svc.run(ctx, () => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            captured = svc.tenantId;
            resolve();
          }, 10);
        });
      });

      expect(captured).toBe('tenant-timeout');
    });
  });

  // ─── Nesting and isolation ─────────────────────────────────────────────────

  describe('nesting and isolation', () => {
    it('inner run() overrides outer context', async () => {
      const outer = makeContext({ tenantId: 'tenant-outer' });
      const inner = makeContext({ tenantId: 'tenant-inner' });
      const results: string[] = [];

      await svc.run(outer, async () => {
        results.push(svc.tenantId); // outer

        await svc.run(inner, () => {
          results.push(svc.tenantId); // inner overrides
        });

        results.push(svc.tenantId); // back to outer
      });

      expect(results).toEqual(['tenant-outer', 'tenant-inner', 'tenant-outer']);
    });

    it('separate run() calls are fully isolated', async () => {
      const ctx1 = makeContext({ tenantId: 'tenant-A' });
      const ctx2 = makeContext({ tenantId: 'tenant-B' });
      const results: string[] = [];

      await svc.run(ctx1, () => {
        results.push(svc.tenantId);
      });

      await svc.run(ctx2, () => {
        results.push(svc.tenantId);
      });

      expect(results).toEqual(['tenant-A', 'tenant-B']);
    });

    it('context is lost after run() completes (sync)', () => {
      const ctx = makeContext({ tenantId: 'tenant-leak' });
      let outside: string | null = 'NOT_SET';

      svc.run(ctx, () => {
        outside = svc.tenantId;
      });

      expect(outside).toBe('tenant-leak');
      expect(() => svc.tenantId).toThrow(); // context is gone
    });

    it('actorUserId is preserved through run()', async () => {
      const ctx = makeContext({ actorUserId: 'actor-123', actorRole: 'OWNER' });
      let captured: string;

      svc.run(ctx, () => {
        captured = svc.get().actorUserId;
      });

      expect(captured).toBe('actor-123');
    });
  });

  // ─── getOrNull ─────────────────────────────────────────────────────────────

  describe('getOrNull()', () => {
    it('returns full context inside run()', async () => {
      const ctx = makeContext({ tenantId: 'tenant-null-check' });
      let captured: ReturnType<TenantContextService['getOrNull']>;

      await svc.run(ctx, () => {
        captured = svc.getOrNull();
      });

      expect(captured).not.toBeNull();
      expect(captured!.tenantId).toBe('tenant-null-check');
    });

    it('returns null outside run()', () => {
      expect(svc.getOrNull()).toBeNull();
    });
  });

  // ─── Cross-tenant flag ─────────────────────────────────────────────────────

  describe('isCrossTenant flag', () => {
    it('preserves isCrossTenant=true through run()', async () => {
      const ctx = makeContext({ isCrossTenant: true, actorRole: 'SUPER_ADMIN' });
      let captured: boolean;

      svc.run(ctx, () => {
        captured = svc.get().isCrossTenant;
      });

      expect(captured).toBe(true);
    });

    it('preserves isCrossTenant=false through run()', async () => {
      const ctx = makeContext({ isCrossTenant: false });
      let captured: boolean;

      svc.run(ctx, () => {
        captured = svc.get().isCrossTenant;
      });

      expect(captured).toBe(false);
    });
  });
});
