/**
 * IdempotencyService — audit-remediation tests.
 *
 * The P2 report's §10 claimed the unique key on enterprise_event_idempotency
 * was (tenantId, idempotencyKey). It was actually (idempotencyKey, consumerId)
 * — same-key collisions across tenants were possible. The 20260715 migration
 * widened the unique and this service's API was updated to require tenantId.
 *
 * These tests pin the cross-tenant behavior so a future regression can be
 * caught here, not in production.
 */

import { IdempotencyService } from '../idempotency/idempotency.service';
import { FakePrisma } from '../testing/fake-prisma';

describe('IdempotencyService — cross-tenant isolation (audit-remediation)', () => {
  let idem: IdempotencyService;
  let prisma: FakePrisma;

  beforeEach(() => {
    prisma = new FakePrisma();
    idem = new IdempotencyService(prisma as any);
  });

  it('same idempotencyKey under different tenants is two distinct records', async () => {
    await prisma.enterpriseEventIdempotency.create({
      data: { tenantId: 'tenant-a', idempotencyKey: 'k1', consumerId: 'audit' },
    });
    expect(await idem.alreadyApplied('tenant-a', 'k1', 'audit')).toBe(true);
    expect(await idem.alreadyApplied('tenant-b', 'k1', 'audit')).toBe(false);
  });

  it('runOnce executes the side effect once per tenant', async () => {
    let aCount = 0;
    let bCount = 0;

    // Tenant A: first call runs, second call skips.
    await idem.runOnce('k1', 'audit', 'tenant-a', async () => {
      aCount += 1;
    });
    await idem.runOnce('k1', 'audit', 'tenant-a', async () => {
      aCount += 1;
    });

    // Tenant B: independent counters — first call MUST run.
    await idem.runOnce('k1', 'audit', 'tenant-b', async () => {
      bCount += 1;
    });
    await idem.runOnce('k1', 'audit', 'tenant-b', async () => {
      bCount += 1;
    });

    expect(aCount).toBe(1);
    expect(bCount).toBe(1);
  });

  it('same (idempotencyKey, consumerId) under different consumers are distinct records', async () => {
    await idem.runOnce('k1', 'audit', 'tenant-a', async () => {});
    expect(await idem.alreadyApplied('tenant-a', 'k1', 'audit')).toBe(true);
    expect(await idem.alreadyApplied('tenant-a', 'k1', 'other-consumer')).toBe(false);
  });

  it('insert collision (concurrent runOnce) does not re-run the side effect', async () => {
    // Simulate the race: pre-create the marker so runOnce sees already-applied
    // and skips. Mirrors the P2002 path: IdempotencyService.runOnce catches it.
    let runs = 0;
    await prisma.enterpriseEventIdempotency.create({
      data: { tenantId: 'tenant-a', idempotencyKey: 'k1', consumerId: 'audit' },
    });
    const result = await idem.runOnce('k1', 'audit', 'tenant-a', async () => {
      runs += 1;
    });
    expect(result).toBe(false);
    expect(runs).toBe(0);
  });
});
