import { AdminBrevoService } from '../admin-brevo.service';
import type { BrevoEmailService } from '../brevo-email.service';
import type { BrevoSuppressionService } from '../brevo-suppression.service';
import type { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type { PrismaIntegrationCredentialStore } from '../../services/integration-credential.store';
import type { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';

function buildService(
  opts: {
    masterKey?: string;
    webhookSecret?: string;
    tenants?: Array<{
      id: string;
      name: string;
      brevoSenderEmail?: string | null;
      brevoSenderName?: string | null;
      brevoReplyToEmail?: string | null;
    }>;
    credentials?: Array<{
      tenantId: string;
      createdAt?: Date;
      updatedAt?: Date;
    }>;
    usage?: Array<{ tenantId: string; date: Date; sentCount: number }>;
  } = {},
) {
  const tenantsList = opts.tenants ?? [
    { id: 't1', name: 'Acme' },
    { id: 't2', name: 'Bravo' },
    { id: 't3', name: 'Charlie' },
  ];
  const credentialsList = opts.credentials ?? [
    { tenantId: 't1', createdAt: new Date(), updatedAt: new Date() },
  ];
  const usageList = opts.usage ?? [];

  const tenantRow = (id: string) => tenantsList.find((t) => t.id === id);
  const tenantFindUnique = jest.fn(
    async (args: { where: { id: string } }) => tenantRow(args.where.id) ?? null,
  );
  const tenantFindMany = jest.fn(async () => tenantsList);
  const tenantUpdate = jest.fn(async () => ({}));

  const credentialFindUnique = jest.fn(async () => null);
  const credentialFindMany = jest.fn(async () => credentialsList);

  const prisma = {
    tenant: {
      findUnique: tenantFindUnique,
      findMany: tenantFindMany,
      update: tenantUpdate,
    },
    integrationCredential: {
      findUnique: credentialFindUnique,
      findMany: credentialFindMany,
    },
    brevoUsageCounter: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => usageList),
      aggregate: jest.fn(async () => ({ _sum: { sentCount: 7 } })),
      delete: jest.fn(async () => ({})),
    },
    brevoWebhookEvent: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => {
      return Promise.all(ops);
    }),
  } as unknown as PrismaService;

  const credentials = {
    exists: jest.fn(async (id: string) =>
      credentialsList.some((c) => c.tenantId === id),
    ),
    delete: jest.fn(async () => undefined),
  } as unknown as PrismaIntegrationCredentialStore;

  const emailService = {
    invalidate: jest.fn(),
    invalidateIdentity: jest.fn(),
  } as unknown as BrevoEmailService;

  const suppressions = {
    aggregate: jest.fn(async () => ({
      total: 0,
      byReason: {
        BOUNCE_HARD: 0,
        UNSUBSCRIBE: 0,
        ADMIN_BLOCK: 0,
        SPAM_COMPLAINT: 0,
        MANUAL: 0,
      },
      byTenant: [],
    })),
  } as unknown as BrevoSuppressionService;

  const config = {
    get: jest.fn((k: string) => {
      if (k === 'BREVO_MASTER_API_KEY') return opts.masterKey ?? 'xkeysib';
      if (k === 'BREVO_WEBHOOK_SECRET' || k === 'BREVO_WEBHOOK_SIGNING_SECRET')
        return opts.webhookSecret ?? 'shh';
      if (k === 'BREVO_DAILY_LIMIT') return 300;
      if (k === 'EMAIL_FROM_ADDRESS') return 'hello@platform.test';
      if (k === 'EMAIL_FROM_NAME') return 'Platform';
      if (k === 'EMAIL_REPLY_TO') return null;
      if (k === 'BREVO_API_BASE_URL') return 'https://api.brevo.test/v3';
      return undefined;
    }),
  } as unknown as ConfigService;

  return {
    svc: new AdminBrevoService(
      prisma,
      credentials,
      emailService,
      config,
      suppressions,
    ),
    prisma,
    credentials,
    emailService,
    suppressions,
    config,
  };
}

afterEach(() => jest.restoreAllMocks());

describe('AdminBrevoService', () => {
  describe('listTenantRows', () => {
    it('classifies tenants as CONNECTED / MASTER / NOT_CONNECTED', async () => {
      const { svc } = buildService({
        credentials: [
          { tenantId: 't1', createdAt: new Date(), updatedAt: new Date() },
        ],
        tenants: [
          { id: 't1', name: 'Acme' },
          { id: 't2', name: 'Bravo' },
        ],
      });
      const rows = await svc.listTenantRows();
      expect(rows).toHaveLength(2);
      const r1 = rows.find((r) => r.tenantId === 't1');
      const r2 = rows.find((r) => r.tenantId === 't2');
      expect(r1?.status).toBe('CONNECTED');
      expect(r1?.source).toBe('tenant');
      expect(r2?.status).toBe('MASTER');
      expect(r2?.source).toBe('master');
    });

    it('returns NOT_CONNECTED when no master key and no tenant credential', async () => {
      const { svc } = buildService({
        masterKey: '',
        credentials: [],
      });
      const rows = await svc.listTenantRows();
      expect(rows.every((r) => r.status === 'NOT_CONNECTED')).toBe(true);
    });

    it('surfaces today usage and per-tenant sender', async () => {
      const today = new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate(),
        ),
      );
      const { svc } = buildService({
        usage: [
          { tenantId: 't1', date: today, sentCount: 250 },
          { tenantId: 't2', date: today, sentCount: 12 },
        ],
        tenants: [
          { id: 't1', name: 'Acme' },
          {
            id: 't2',
            name: 'Bravo',
            brevoSenderEmail: 'sales@bravo.test',
            brevoSenderName: 'Bravo Sales',
            brevoReplyToEmail: 'reply@bravo.test',
          },
          { id: 't3', name: 'Charlie' },
        ],
        credentials: [
          { tenantId: 't1', createdAt: new Date(), updatedAt: new Date() },
        ],
      });
      const rows = await svc.listTenantRows();
      const r1 = rows.find((r) => r.tenantId === 't1');
      const r2 = rows.find((r) => r.tenantId === 't2');
      expect(r1?.sentToday).toBe(250);
      expect(r1?.isAtWarning).toBe(true);
      expect(r2?.brevoSenderEmail).toBe('sales@bravo.test');
    });
  });

  describe('platformStats', () => {
    it('aggregates tenantsConnected, sentToday, and config flags', async () => {
      const today = new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate(),
        ),
      );
      const { svc } = buildService({
        usage: [
          { tenantId: 't1', date: today, sentCount: 100 },
          { tenantId: 't2', date: today, sentCount: 50 },
        ],
        credentials: [
          { tenantId: 't1', createdAt: new Date(), updatedAt: new Date() },
          { tenantId: 't2', createdAt: new Date(), updatedAt: new Date() },
        ],
      });
      const stats = await svc.platformStats();
      expect(stats.tenantsConnected).toBe(2);
      expect(stats.tenantsUsingMasterKey).toBe(1); // t3
      expect(stats.tenantsNotRouted).toBe(0);
      expect(stats.totalSentToday).toBe(150);
      expect(stats.totalSentLast30Days).toBe(7);
      expect(stats.masterKeyConfigured).toBe(true);
      expect(stats.webhookSecretConfigured).toBe(true);
      expect(stats.globalFromAddress).toBe('hello@platform.test');
      expect(stats.tenantLimits['t1']).toBe(300);
    });
  });

  describe('usageSeries', () => {
    it('returns 30 entries with totals summed per day', async () => {
      const { svc } = buildService();
      const series = await svc.usageSeries();
      expect(series).toHaveLength(30);
      expect(series[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('disconnectTenant', () => {
    it('rejects unknown tenantId', async () => {
      const { svc } = buildService();
      await expect(svc.disconnectTenant('nope')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('clears credential + sender and invalidates caches', async () => {
      const { svc, credentials, emailService } = buildService({
        tenants: [
          {
            id: 't1',
            name: 'Acme',
            brevoSenderEmail: 'sales@x.test',
          },
        ],
      });
      const r = await svc.disconnectTenant('t1');
      expect(r.revoked).toBe(true);
      expect(credentials.delete).toHaveBeenCalledWith(
        't1',
        IntegrationProvider.BREVO,
      );
      expect(emailService.invalidate).toHaveBeenCalledWith('t1');
      expect(emailService.invalidateIdentity).toHaveBeenCalledWith('t1');
    });

    it('skips sender cleanup when tenant had no sender identity', async () => {
      const { svc, emailService } = buildService({
        tenants: [{ id: 't1', name: 'Acme' }],
      });
      const r = await svc.disconnectTenant('t1');
      expect(r.hadSenderIdentity).toBe(false);
      expect(emailService.invalidateIdentity).not.toHaveBeenCalled();
    });
  });

  describe('resetTodayQuota', () => {
    it('rejects unknown tenantId', async () => {
      const { svc } = buildService();
      await expect(svc.resetTodayQuota('nope')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listEvents', () => {
    it('passes filters through to prisma where clause', async () => {
      const { svc, prisma } = buildService();
      const findMany = jest.fn(async () => []);
      const count = jest.fn(async () => 0);
      (
        prisma.brevoWebhookEvent as unknown as {
          findMany: jest.Mock;
          count: jest.Mock;
        }
      ).findMany = findMany;
      (prisma.brevoWebhookEvent as unknown as { count: jest.Mock }).count =
        count;
      await svc.listEvents({
        tenantId: 't1',
        eventType: 'DELIVERED',
        messageId: 'm1',
        from: new Date('2026-01-01'),
        to: new Date('2026-02-01'),
        limit: 100,
        offset: 50,
      });
      expect(findMany).toHaveBeenCalledTimes(1);
      const args = (findMany.mock.calls as unknown[][])[0]?.[0] as {
        where: Record<string, Record<string, unknown>>;
        take: number;
        skip: number;
      };
      expect(args.where.tenantId).toBe('t1');
      expect(args.where.eventType).toBe('DELIVERED');
      expect(args.where.messageId).toBe('m1');
      expect(args.where.receivedAt.gte).toBeInstanceOf(Date);
      expect(args.where.receivedAt.lt).toBeInstanceOf(Date);
      expect(args.take).toBe(100);
      expect(args.skip).toBe(50);
    });

    it('clamps limit to 500 and offset to ≥0', async () => {
      const { svc, prisma } = buildService();
      const findMany = jest.fn(async () => []);
      (
        prisma.brevoWebhookEvent as unknown as { findMany: jest.Mock }
      ).findMany = findMany;
      (prisma.brevoWebhookEvent as unknown as { count: jest.Mock }).count =
        jest.fn(async () => 0);
      await svc.listEvents({ limit: 9999, offset: -10 });
      const args = (findMany.mock.calls as unknown[][])[0]?.[0] as {
        take: number;
        skip: number;
      };
      expect(args.take).toBe(500);
      expect(args.skip).toBe(0);
    });
  });

  describe('healthCheck', () => {
    it('returns not-configured state when no master key', async () => {
      const { svc } = buildService({ masterKey: '' });
      const h = await svc.healthCheck();
      expect(h.ok).toBe(false);
      expect(h.source).toBe('none');
      expect(h.error).toContain('BREVO_MASTER_API_KEY');
    });

    it('probes Brevo account API with master key', async () => {
      const { svc } = buildService({ masterKey: 'xkeysib-ok' });
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ email: 'platform@x' }), {
            status: 200,
          }),
        );
      const h = await svc.healthCheck();
      expect(h.ok).toBe(true);
      expect(h.source).toBe('master');
      expect(h.account?.['email']).toBe('platform@x');
      expect(h.webhook.secretConfigured).toBe(true);
      expect(h.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('surfaces upstream errors', async () => {
      const { svc } = buildService({ masterKey: 'xkeysib-bad' });
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('{}', { status: 401 }));
      const h = await svc.healthCheck();
      expect(h.ok).toBe(false);
      expect(h.error).toContain('Brevo HTTP 401');
    });

    it('surfaces network errors', async () => {
      const { svc } = buildService({ masterKey: 'xkeysib-net' });
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('ECONNRESET'));
      const h = await svc.healthCheck();
      expect(h.ok).toBe(false);
      expect(h.error).toBe('ECONNRESET');
    });
  });
});
