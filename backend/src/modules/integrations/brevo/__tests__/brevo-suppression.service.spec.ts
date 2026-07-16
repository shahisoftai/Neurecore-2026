import { BrevoSuppressionService } from '../brevo-suppression.service';
import type { PrismaService } from '../../../../infrastructure/database/prisma.service';

type SuppressionRow = {
  id: string;
  tenantId: string | null;
  email: string;
  reason: string;
  details: Record<string, unknown>;
  addedBy: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function buildService(
  initialRows: SuppressionRow[] = [],
  initialGroupBy: Record<string, number> = {},
) {
  const allRows = new Map<string, SuppressionRow>(
    initialRows.map((r) => [`${r.tenantId ?? '*'}::${r.email}`, r]),
  );

  const prisma = {
    brevoSuppression: {
      findUnique: jest.fn(
        async (args: {
          where: { tenantId_email: { tenantId: string; email: string } };
        }) => {
          const key = `${args.where.tenantId_email.tenantId}::${args.where.tenantId_email.email}`;
          return allRows.get(key) ?? null;
        },
      ),
      findFirst: jest.fn(
        async (args: {
          where?: { email?: string; OR?: Array<{ tenantId?: string | null }> };
        }) => {
          const wantEmail = (args?.where?.email ?? '').toLowerCase();
          for (const r of allRows.values()) {
            if (
              r.email.toLowerCase() === wantEmail &&
              (!args?.where?.OR ||
                args.where.OR.some((c) => c.tenantId === r.tenantId))
            ) {
              return r;
            }
          }
          return null;
        },
      ),
      findMany: jest.fn(async (args: { where: { email?: { in: string[] }; OR?: unknown } }) => {
        const emails = args.where.email?.in ?? [];
        const out: SuppressionRow[] = [];
        for (const e of emails) {
          const tenantRow = allRows.get(`*::${e}`);
          if (tenantRow) out.push({ ...tenantRow, email: e });
        }
        return out;
      }),
      count: jest.fn(async () => allRows.size),
      create: jest.fn(
        async (args: {
          data: Omit<SuppressionRow, 'id' | 'createdAt' | 'updatedAt'>;
        }) => {
          const r: SuppressionRow = {
            id: `sup-${Math.random().toString(36).slice(2, 10)}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...args.data,
          };
          allRows.set(`${r.tenantId ?? '*'}::${r.email}`, r);
          return r;
        },
      ),
      update: jest.fn(
        async (args: {
          where: { id: string };
          data: Partial<SuppressionRow>;
        }) => {
          for (const [k, v] of allRows) {
            if (v.id === args.where.id) {
              const updated = { ...v, ...args.data };
              allRows.set(k, updated);
              return updated;
            }
          }
          throw new Error('not found');
        },
      ),
      delete: jest.fn(async (args: { where: { id: string } }) => {
        for (const [k, v] of allRows) {
          if (v.id === args.where.id) {
            allRows.delete(k);
            return v;
          }
        }
        throw new Error('not found');
      }),
      groupBy: jest.fn(async (args: { by: string[] }) => {
        if (args.by.includes('reason') && args.by.length === 1) {
          const counts: Record<string, number> = { ...initialGroupBy };
          for (const r of allRows.values()) {
            counts[r.reason] = (counts[r.reason] ?? 0) + 1;
          }
          return Object.entries(counts).map(([reason, _count]) => ({
            reason,
            _count: counts[reason],
          }));
        }
        if (args.by.includes('tenantId') && args.by.length === 1) {
          const map = new Map<string | null, number>();
          for (const r of allRows.values()) {
            map.set(r.tenantId, (map.get(r.tenantId) ?? 0) + 1);
          }
          return Array.from(map.entries()).map(([tenantId, _count]) => ({
            tenantId,
            _count: map.get(tenantId) ?? 0,
          }));
        }
        return [];
      }),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  return { svc: new BrevoSuppressionService(prisma), prisma, rows: allRows };
}

afterEach(() => jest.restoreAllMocks());

describe('BrevoSuppressionService', () => {
  describe('upsert', () => {
    it('creates a new row with no existing record', async () => {
      const { svc, rows } = buildService();
      const r = await svc.upsert({
        email: 'a@b.test',
        reason: 'BOUNCE_HARD',
        tenantId: 't1',
        addedBy: 'system',
      });
      expect(r.created).toBe(true);
      expect(rows.get('t1::a@b.test')).toBeDefined();
    });

    it('downgrades to nothing when existing row has stronger reason', async () => {
      const { svc } = buildService([
        {
          id: 'existing',
          tenantId: 't1',
          email: 'a@b.test',
          reason: 'ADMIN_BLOCK',
          details: {},
          addedBy: 'admin',
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const r = await svc.upsert({
        email: 'a@b.test',
        reason: 'BOUNCE_HARD',
        tenantId: 't1',
      });
      expect(r.created).toBe(false);
      // reason stays ADMIN_BLOCK
      expect((await svc.isSuppressed('t1', 'a@b.test')) === true).toBe(true);
    });

    it('upgrades to stronger reason when incoming wins', async () => {
      const { svc, rows } = buildService([
        {
          id: 'existing',
          tenantId: 't1',
          email: 'a@b.test',
          reason: 'UNSUBSCRIBE',
          details: {},
          addedBy: 'system',
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      await svc.upsert({
        email: 'a@b.test',
        reason: 'ADMIN_BLOCK',
        tenantId: 't1',
        addedBy: 'admin',
      });
      const row = rows.get('t1::a@b.test');
      expect(row?.reason).toBe('ADMIN_BLOCK');
    });

    it('lowercases and trims email', async () => {
      const { svc, rows } = buildService();
      await svc.upsert({
        email: '  ALICE@Example.COM ',
        reason: 'UNSUBSCRIBE',
        tenantId: null,
      });
      expect(rows.get('*::alice@example.com')).toBeDefined();
    });

    it('handles global (tenantId=null) rows', async () => {
      const { svc, rows } = buildService();
      await svc.upsert({
        email: 'a@b.test',
        reason: 'ADMIN_BLOCK',
        tenantId: null,
      });
      expect(rows.get('*::a@b.test')).toBeDefined();
    });
  });

  describe('isSuppressed', () => {
    it('returns true for tenant row', async () => {
      const { svc } = buildService([
        {
          id: 's1',
          tenantId: 't1',
          email: 'a@b.test',
          reason: 'BOUNCE_HARD',
          details: {},
          addedBy: 'system',
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      expect(await svc.isSuppressed('t1', 'A@B.test')).toBe(true);
    });

    it('returns false when no row', async () => {
      const { svc } = buildService();
      expect(await svc.isSuppressed('t1', 'unknown@x.test')).toBe(false);
    });
  });

  describe('filterSuppressed', () => {
    it('returns the subset of emails blocked', async () => {
      const { svc } = buildService([
        {
          id: 's1',
          tenantId: null,
          email: 'blocked@x.test',
          reason: 'ADMIN_BLOCK',
          details: {},
          addedBy: 'admin',
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const set = await svc.filterSuppressed('tenant-1', [
        'BLOCKED@x.test',
        'clean@x.test',
      ]);
      expect(set.has('blocked@x.test')).toBe(true);
      expect(set.has('clean@x.test')).toBe(false);
    });

    it('returns empty Set for empty input', async () => {
      const { svc } = buildService();
      const set = await svc.filterSuppressed('tenant-1', []);
      expect(set.size).toBe(0);
    });
  });

  describe('aggregate', () => {
    it('counts total + per-reason + per-tenant', async () => {
      const { svc } = buildService(
        [
          {
            id: 'a',
            tenantId: 't1',
            email: 'a@x',
            reason: 'BOUNCE_HARD',
            details: {},
            addedBy: 'system',
            expiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'b',
            tenantId: 't2',
            email: 'b@x',
            reason: 'UNSUBSCRIBE',
            details: {},
            addedBy: 'system',
            expiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'c',
            tenantId: null,
            email: 'c@x',
            reason: 'ADMIN_BLOCK',
            details: {},
            addedBy: 'admin',
            expiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        {},
      );
      const r = await svc.aggregate();
      expect(r.total).toBe(3);
      expect(r.byReason.BOUNCE_HARD).toBe(1);
      expect(r.byReason.UNSUBSCRIBE).toBe(1);
      expect(r.byReason.ADMIN_BLOCK).toBe(1);
      expect(r.byTenant).toHaveLength(3);
    });
  });

  describe('remove', () => {
    it('removes an existing row', async () => {
      const { svc } = buildService([
        {
          id: 'a',
          tenantId: 't1',
          email: 'a@x',
          reason: 'BOUNCE_HARD',
          details: {},
          addedBy: 'system',
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const r = await svc.remove('a');
      expect(r.deleted).toBe(true);
    });

    it('returns deleted=false for missing id', async () => {
      const { svc } = buildService();
      const r = await svc.remove('missing');
      expect(r.deleted).toBe(false);
    });
  });
});
