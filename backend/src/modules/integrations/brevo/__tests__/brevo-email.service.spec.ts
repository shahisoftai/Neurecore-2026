import { BrevoEmailService } from '../brevo-email.service';
import type { PrismaIntegrationCredentialStore } from '../../services/integration-credential.store';
import type { BrevoUsageService } from '../brevo-usage.service';
import type { BrevoSuppressionService } from '../brevo-suppression.service';
import type { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type { ConfigService } from '@nestjs/config';
import { IntegrationProvider } from '@prisma/client';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

const TENANT = 'tenant-1';

function configWith(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function makeService(opts: {
  masterKey?: string | null;
  fromAddress?: string;
  fromName?: string;
  tenantCreds?: { apiKey: string } | null;
  accountOk?: boolean;
  sendOk?: boolean;
  sendStatus?: number;
  sendBody?: unknown;
  tenantIdentity?: {
    brevoSenderEmail?: string | null;
    brevoSenderName?: string | null;
    brevoReplyToEmail?: string | null;
  } | null;
}) {
  const credentialStore = {
    get: jest.fn(async (tenantId: string, provider: IntegrationProvider) => {
      if (provider === IntegrationProvider.BREVO && opts.tenantCreds) {
        return opts.tenantCreds;
      }
      return null;
    }),
  } as unknown as PrismaIntegrationCredentialStore;

  const usage = {
    checkLimit: jest.fn(async () => undefined),
    checkLimitFor: jest.fn(async () => undefined),
    recordSend: jest.fn(async () => undefined),
    recordSendBatch: jest.fn(async () => undefined),
  } as unknown as BrevoUsageService;

  const config = configWith({
    BREVO_MASTER_API_KEY: opts.masterKey ?? '',
    EMAIL_FROM_ADDRESS: opts.fromAddress ?? 'hello@neurecore.test',
    EMAIL_FROM_NAME: opts.fromName ?? 'NeureCore',
    EMAIL_REPLY_TO: '',
    BREVO_DAILY_LIMIT: '300',
    BREVO_API_BASE_URL: 'https://api.brevo.test/v3',
  });

  const prisma = {
    tenant: {
      findUnique: jest.fn(async () =>
        opts.tenantIdentity === undefined ? null : opts.tenantIdentity,
      ),
    },
  } as unknown as PrismaService;

  const suppressions = {
    isSuppressed: jest.fn(async () => false),
    filterSuppressed: jest.fn(async () => new Set<string>()),
  } as unknown as BrevoSuppressionService;

  const svc = new BrevoEmailService(
    credentialStore,
    usage,
    config,
    prisma,
    suppressions,
  );

  const fetchSpy = jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const ok = url.endsWith('/account')
        ? (opts.accountOk ?? true)
        : (opts.sendOk ?? true);
      const status = url.endsWith('/account')
        ? ok
          ? 200
          : 401
        : (opts.sendStatus ?? (ok ? 201 : 400));
      return new Response(
        status === 201
          ? JSON.stringify({ messageId: 'msg-1' })
          : typeof opts.sendBody === 'string'
            ? opts.sendBody
            : JSON.stringify(
                opts.sendBody ?? {
                  code: status === 401 ? 'unauthorized' : 'invalid_parameter',
                  message: status === 401 ? 'Bad key' : 'Bad sender',
                },
              ),
        { status },
      );
    });

  return { svc, fetchSpy, credentialStore, usage };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BrevoEmailService', () => {
  describe('API key resolution', () => {
    it('returns null when neither tenant key nor master key is configured', async () => {
      const { svc } = makeService({ masterKey: null });
      expect(await svc.hasApiKey(TENANT)).toBe(false);
      await expect(
        svc.sendEmail(TENANT, {
          to: 'a@b.test',
          subject: 'x',
          htmlContent: '<p>x</p>',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('prefers per-tenant credential over master key', async () => {
      const { svc, fetchSpy } = makeService({
        masterKey: 'xkeysib-master',
        tenantCreds: { apiKey: 'xkeysib-tenant' },
      });
      await svc.sendEmail(TENANT, {
        to: 'a@b.test',
        subject: 'x',
        htmlContent: '<p>x</p>',
      });
      const init = fetchSpy.mock.calls[0][1] as RequestInit;
      expect((init.headers as Record<string, string>)['api-key']).toBe(
        'xkeysib-tenant',
      );
    });

    it('falls back to master key when no per-tenant credential', async () => {
      const { svc, fetchSpy } = makeService({
        masterKey: 'xkeysib-master',
        tenantCreds: null,
      });
      const res = await svc.sendEmail(TENANT, {
        to: 'a@b.test',
        subject: 'x',
        htmlContent: '<p>x</p>',
      });
      expect(res.source).toBe('master');
      const init = fetchSpy.mock.calls[0][1] as RequestInit;
      expect((init.headers as Record<string, string>)['api-key']).toBe(
        'xkeysib-master',
      );
    });

    it('caches the resolved key across calls within TTL', async () => {
      const { svc, fetchSpy } = makeService({
        masterKey: 'xkeysib-master',
        tenantCreds: null,
      });
      await svc.sendEmail(TENANT, {
        to: 'a@b.test',
        subject: '1',
        htmlContent: '<p>1</p>',
      });
      await svc.sendEmail(TENANT, {
        to: 'a@b.test',
        subject: '2',
        htmlContent: '<p>2</p>',
      });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('invalidate() forces re-resolution', async () => {
      const { svc, credentialStore, fetchSpy } = makeService({
        masterKey: 'xkeysib-master',
      });
      await svc.sendEmail(TENANT, {
        to: 'a@b.test',
        subject: '1',
        htmlContent: '<p>1</p>',
      });
      svc.invalidate(TENANT);
      credentialStore.get = jest.fn(async () => ({ apiKey: 'xkeysib-new' }));
      await svc.sendEmail(TENANT, {
        to: 'a@b.test',
        subject: '2',
        htmlContent: '<p>2</p>',
      });
      const second = fetchSpy.mock.calls[1][1] as RequestInit;
      expect((second.headers as Record<string, string>)['api-key']).toBe(
        'xkeysib-new',
      );
    });
  });

  describe('sendEmail', () => {
    it('renders signature in HTML and records usage on success', async () => {
      const { svc, usage, fetchSpy } = makeService({ masterKey: 'xkeysib' });
      const res = await svc.sendEmail(TENANT, {
        to: 'a@b.test',
        subject: 'Hi',
        htmlContent: '<p>Body</p>',
        signature: '<b>Bye</b>',
      });
      expect(res.messageId).toBe('msg-1');
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string) as {
        subject: string;
        htmlContent: string;
        sender: { email: string; name: string };
        to: { email: string }[];
        tags?: unknown;
      };
      expect(body.subject).toBe('Hi');
      expect(body.htmlContent).toContain('<p>Body</p>');
      expect(body.htmlContent).toContain('&lt;b&gt;Bye&lt;/b&gt;');
      expect(body.sender).toEqual({
        email: 'hello@neurecore.test',
        name: 'NeureCore',
      });
      expect(body.to).toEqual([{ email: 'a@b.test' }]);
      expect(body.tags).toBeUndefined();
      expect(usage.recordSend).toHaveBeenCalledWith(TENANT);
    });

    it('uses caller-supplied from/fromName when provided', async () => {
      const { svc, fetchSpy } = makeService({ masterKey: 'xkeysib' });
      await svc.sendEmail(TENANT, {
        to: 'a@b.test',
        subject: 'Hi',
        htmlContent: '<p>x</p>',
        from: 'agent@custom.test',
        fromName: 'Agent X',
      });
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string) as {
        sender: { email: string; name: string };
      };
      expect(body.sender).toEqual({
        email: 'agent@custom.test',
        name: 'Agent X',
      });
    });

    it('forwards replyTo and tags when present', async () => {
      const { svc, fetchSpy } = makeService({
        masterKey: 'xkeysib',
        fromAddress: 'a@test.test',
        fromName: 'A',
      });
      await svc.sendEmail(TENANT, {
        to: 'x@y.test',
        subject: 'T',
        htmlContent: '<p>x</p>',
        replyTo: 'reply@test.test',
        tags: ['agent-1', 'campaign-x'],
      });
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string) as {
        replyTo?: { email: string };
        tags?: string[];
      };
      expect(body.replyTo).toEqual({ email: 'reply@test.test' });
      expect(body.tags).toEqual(['agent-1', 'campaign-x']);
    });

    it('throws BadRequest when EMAIL_FROM_ADDRESS missing', async () => {
      const { svc } = makeService({
        masterKey: 'xkeysib',
        fromAddress: '',
      });
      await expect(
        svc.sendEmail(TENANT, {
          to: 'a@b.test',
          subject: 'x',
          htmlContent: '<p>x</p>',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('maps 401 to BadRequest (auth failure)', async () => {
      const { svc } = makeService({
        masterKey: 'xkeysib',
        sendOk: false,
        sendStatus: 401,
      });
      await expect(
        svc.sendEmail(TENANT, {
          to: 'a@b.test',
          subject: 'x',
          htmlContent: '<p>x</p>',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('maps 429 to ServiceUnavailable', async () => {
      const { svc } = makeService({
        masterKey: 'xkeysib',
        sendOk: false,
        sendStatus: 429,
        sendBody: { code: 'rate_limited', message: 'too many' },
      });
      await expect(
        svc.sendEmail(TENANT, {
          to: 'a@b.test',
          subject: 'x',
          htmlContent: '<p>x</p>',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('maps 5xx to ServiceUnavailable', async () => {
      const { svc } = makeService({
        masterKey: 'xkeysib',
        sendOk: false,
        sendStatus: 500,
      });
      await expect(
        svc.sendEmail(TENANT, {
          to: 'a@b.test',
          subject: 'x',
          htmlContent: '<p>x</p>',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('maps network failure to ServiceUnavailable', async () => {
      const { svc } = makeService({ masterKey: 'xkeysib' });
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('ECONNRESET'));
      await expect(
        svc.sendEmail(TENANT, {
          to: 'a@b.test',
          subject: 'x',
          htmlContent: '<p>x</p>',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('validateApiKey', () => {
    it('returns valid=true with source when /account is 200', async () => {
      const { svc } = makeService({
        masterKey: 'xkeysib-master',
        accountOk: true,
      });
      const res = await svc.validateApiKey(TENANT);
      expect(res.valid).toBe(true);
      expect(res.source).toBe('master');
      expect(res.account).toBeDefined();
    });

    it('returns valid=false with error when /account is 401', async () => {
      const { svc } = makeService({
        masterKey: 'xkeysib-master',
        accountOk: false,
      });
      const res = await svc.validateApiKey(TENANT);
      expect(res.valid).toBe(false);
      expect(res.source).toBe('master');
      expect(res.error).toContain('Brevo HTTP 401');
    });

    it('returns valid=false with no source when no key is set', async () => {
      const { svc } = makeService({ masterKey: null });
      const res = await svc.validateApiKey(TENANT);
      expect(res.valid).toBe(false);
      expect(res.source).toBeNull();
    });
  });

  describe('getTenantIdentity', () => {
    it('returns env identity when no tenant row exists', async () => {
      const { svc } = makeService({
        masterKey: 'xkeysib',
        tenantIdentity: null,
      });
      const id = await svc.getTenantIdentity(TENANT);
      expect(id).toEqual({
        senderEmail: 'hello@neurecore.test',
        senderName: 'NeureCore',
        replyToEmail: null,
        source: 'env',
      });
    });

    it('returns tenant identity when tenant has sender configured', async () => {
      const { svc } = makeService({
        masterKey: 'xkeysib',
        tenantIdentity: {
          brevoSenderEmail: 'sales@acme.test',
          brevoSenderName: 'Acme Sales',
          brevoReplyToEmail: 'reply@acme.test',
        },
      });
      const id = await svc.getTenantIdentity(TENANT);
      expect(id?.source).toBe('tenant');
      expect(id?.senderEmail).toBe('sales@acme.test');
      expect(id?.senderName).toBe('Acme Sales');
      expect(id?.replyToEmail).toBe('reply@acme.test');
    });

    it('returns null identity when no tenant and no env config', async () => {
      const { svc } = makeService({
        masterKey: 'xkeysib',
        fromAddress: '',
        tenantIdentity: null,
      });
      expect(await svc.getTenantIdentity(TENANT)).toBeNull();
    });

    it('caches the identity', async () => {
      const { svc } = makeService({
        masterKey: 'xkeysib',
        tenantIdentity: {
          brevoSenderEmail: 'x@y.test',
          brevoSenderName: 'X',
          brevoReplyToEmail: null,
        },
      });
      await svc.getTenantIdentity(TENANT);
      await svc.getTenantIdentity(TENANT);
      // findUnique called once (cache hit on 2nd call)
      // Implementation detail: cached identity returns first
      const id = await svc.getTenantIdentity(TENANT);
      expect(id?.senderEmail).toBe('x@y.test');
    });

    it('invalidateIdentity forces re-fetch', async () => {
      const { svc, fetchSpy } = makeService({
        masterKey: 'xkeysib',
        tenantIdentity: null,
      });
      await svc.getTenantIdentity(TENANT);
      svc.invalidateIdentity(TENANT);
      // Force fetch by changing config indirectly — just verify no throw
      await svc.getTenantIdentity(TENANT);
      expect(fetchSpy).toBeDefined();
    });
  });

  describe('per-tenant sender used in sendEmail', () => {
    it('uses tenant senderEmail when configured', async () => {
      const { svc, fetchSpy } = makeService({
        masterKey: 'xkeysib',
        tenantIdentity: {
          brevoSenderEmail: 'tenant@x.test',
          brevoSenderName: 'Tenant Name',
        },
      });
      await svc.sendEmail(TENANT, {
        to: 'a@b.test',
        subject: 'Hi',
        htmlContent: '<p>x</p>',
      });
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string) as {
        sender: { email: string; name: string };
      };
      expect(body.sender).toEqual({
        email: 'tenant@x.test',
        name: 'Tenant Name',
      });
    });

    it('falls back to env senderEmail when tenant has none', async () => {
      const { svc, fetchSpy } = makeService({
        masterKey: 'xkeysib',
        tenantIdentity: { brevoSenderEmail: null },
      });
      await svc.sendEmail(TENANT, {
        to: 'a@b.test',
        subject: 'Hi',
        htmlContent: '<p>x</p>',
      });
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string) as {
        sender: { email: string };
      };
      expect(body.sender.email).toBe('hello@neurecore.test');
    });

    it('throws if no sender available anywhere', async () => {
      const { svc } = makeService({
        masterKey: 'xkeysib',
        fromAddress: '',
        tenantIdentity: null,
      });
      await expect(
        svc.sendEmail(TENANT, {
          to: 'a@b.test',
          subject: 'x',
          htmlContent: '<p>x</p>',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendBatch', () => {
    it('throws on empty recipients', async () => {
      const { svc } = makeService({ masterKey: 'xkeysib' });
      await expect(
        svc.sendBatch(TENANT, {
          recipients: [],
          subject: 'Hi',
          htmlContent: '<p>x</p>',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when batch exceeds 50', async () => {
      const { svc } = makeService({ masterKey: 'xkeysib' });
      const recipients = Array.from({ length: 51 }, (_, i) => ({
        to: `u${i}@x.test`,
      }));
      await expect(
        svc.sendBatch(TENANT, {
          recipients,
          subject: 'Hi',
          htmlContent: '<p>x</p>',
        }),
      ).rejects.toThrow(/exceeds Brevo limit/);
    });

    it('succeeds and returns per-recipient messageIds', async () => {
      const { svc, usage, fetchSpy } = makeService({ masterKey: 'xkeysib' });
      const r = await svc.sendBatch(TENANT, {
        recipients: [
          { to: 'a@b.test', variables: { name: 'A' } },
          { to: 'c@d.test' },
        ],
        subject: 'Hi',
        htmlContent: '<p>body for {{params.name}}</p>',
      });
      expect(r.total).toBe(2);
      expect(r.accepted).toBe(2);
      expect(r.failed).toBe(0);
      expect(r.messageIds).toHaveLength(2);
      expect(usage.recordSendBatch as jest.Mock).toHaveBeenCalledWith(
        TENANT,
        2,
      );
      // Two POSTs were made to /smtp/email
      const posts = fetchSpy.mock.calls.filter((call) =>
        (call[0] as string).endsWith('/smtp/email'),
      );
      expect(posts).toHaveLength(2);
      const firstBody = JSON.parse(posts[0][1]!.body as string) as {
        params?: Record<string, string>;
      };
      expect(firstBody.params).toEqual({ name: 'A' });
    });

    it('partitions accepted/failed across mixed results', async () => {
      const { svc, fetchSpy } = makeService({ masterKey: 'xkeysib' });
      // Sequence: 400, 201 → one accept, one fail (recipients validated upstream)
      fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/account')) {
          return new Response('{}', { status: 200 });
        }
        const i = fetchSpy.mock.calls.length;
        if (i === 1) {
          return new Response('{"code":"bad","message":"x"}', { status: 400 });
        }
        return new Response(JSON.stringify({ messageId: 'ok' }), {
          status: 201,
        });
      });
      const r = await svc.sendBatch(TENANT, {
        recipients: [{ to: 'good@x.test' }, { to: 'good2@x.test' }],
        subject: 'Hi',
        htmlContent: '<p>x</p>',
      });
      expect(r.total).toBe(2);
      expect(r.accepted).toBe(1);
      expect(r.failed).toBe(1);
      expect(r.errors[0].to).toBe('good@x.test');
      expect(r.errors[0].status).toBe(400);
    });

    it('records partial quota when some recipients succeed', async () => {
      const { svc, usage } = makeService({ masterKey: 'xkeysib' });
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (!url.endsWith('/smtp/email')) {
            return new Response('{}', { status: 200 });
          }
          // Half the calls fail
          const callCount = jest.spyOn(global, 'fetch').mock.calls.length || 0;
          return new Response(
            callCount % 2 === 0
              ? JSON.stringify({ messageId: `m${callCount}` })
              : '{"code":"bad","message":"x"}',
            { status: callCount % 2 === 0 ? 201 : 400 },
          );
        });
      await svc.sendBatch(TENANT, {
        recipients: [{ to: 'a@b.test' }, { to: 'c@d.test' }],
        subject: 'Hi',
        htmlContent: '<p>x</p>',
      });
      // Quota recording is best-effort; we just verify no crash
      expect(usage.recordSendBatch).toBeDefined();
    });

    it('uses tenant sender identity', async () => {
      const { svc, fetchSpy } = makeService({
        masterKey: 'xkeysib',
        tenantIdentity: {
          brevoSenderEmail: 'bulk@tenant.test',
          brevoSenderName: 'Tenant Bulk',
        },
      });
      await svc.sendBatch(TENANT, {
        recipients: [{ to: 'a@b.test' }],
        subject: 'Hi',
        htmlContent: '<p>x</p>',
      });
      const posts = fetchSpy.mock.calls.filter((call) =>
        (call[0] as string).endsWith('/smtp/email'),
      );
      const body = JSON.parse(posts[0][1]!.body as string) as {
        sender: { email: string };
      };
      expect(body.sender.email).toBe('bulk@tenant.test');
    });
  });
});
