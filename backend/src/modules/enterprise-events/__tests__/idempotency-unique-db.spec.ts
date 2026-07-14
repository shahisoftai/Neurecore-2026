/**
 * enterprise_event_idempotency UNIQUE — REAL PostgreSQL integration test.
 *
 * Companion to the in-memory idem cross-tenant spec. With DATABASE_TEST_URL
 * set, this spec proves the SQL UNIQUE INDEX
 * (tenantId, idempotencyKey, consumerId) actually rejects cross-tenant inserts
 * at the DB layer.
 *
 * GATED on DATABASE_TEST_URL (same convention as the work-runtime/approval-chains
 * gated specs).
 */

import { PrismaClient } from '@prisma/client';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('enterprise_event_idempotency UNIQUE — REAL PostgreSQL', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE enterprise_event_idempotency
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE enterprise_event_idempotency RESTART IDENTITY CASCADE
    `);
  });

  it('rejects a duplicate insert with the same (tenantId, key, consumer)', async () => {
    const A = 'tenant-a';
    const B = 'tenant-b';
    const KEY = 'k-collision-1';
    const CONS = 'fabric-audit';

    await prisma.enterpriseEventIdempotency.create({
      data: { idempotencyKey: KEY, consumerId: CONS, tenantId: A },
    });
    await expect(
      prisma.enterpriseEventIdempotency.create({
        data: { idempotencyKey: KEY, consumerId: CONS, tenantId: A },
      }),
    ).rejects.toThrow();

    // Different tenant, same key+consumer: ALLOWED (cross-tenant).
    const created = await prisma.enterpriseEventIdempotency.create({
      data: { idempotencyKey: KEY, consumerId: CONS, tenantId: B },
    });
    expect(created.tenantId).toBe(B);
  });

  it('permits the same key under different tenants', async () => {
    const KEY = 'k-isolation';
    const CONS = 'fabric-audit';
    const a = await prisma.enterpriseEventIdempotency.create({
      data: { idempotencyKey: KEY, consumerId: CONS, tenantId: 'tenant-a' },
    });
    const b = await prisma.enterpriseEventIdempotency.create({
      data: { idempotencyKey: KEY, consumerId: CONS, tenantId: 'tenant-b' },
    });
    expect(a.id).not.toBe(b.id);
  });

  it('permits the same key+tenant under different consumers', async () => {
    const a = await prisma.enterpriseEventIdempotency.create({
      data: { idempotencyKey: 'k-c', consumerId: 'audit', tenantId: 'tenant-a' },
    });
    const b = await prisma.enterpriseEventIdempotency.create({
      data: { idempotencyKey: 'k-c', consumerId: 'projection', tenantId: 'tenant-a' },
    });
    expect(a.id).not.toBe(b.id);
  });
});
