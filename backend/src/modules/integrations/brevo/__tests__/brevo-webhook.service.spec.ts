import { BrevoWebhookService } from '../brevo-webhook.service';
import type { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type { BrevoUsageService } from '../brevo-usage.service';
import type { BrevoSuppressionService } from '../brevo-suppression.service';
import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

function buildService(
  opts: {
    secret?: string;
    existingWebhookEvent?: { id?: string };
  } = {},
) {
  const prisma = {
    brevoWebhookEvent: {
      create: jest.fn(async (args: unknown) => {
        if (opts.existingWebhookEvent) {
          const e = new Error('unique constraint') as Error & { code: string };
          e.code = 'P2002';
          throw e;
        }
        return { id: 'webhook-1', ...(args as object) };
      }),
    },
    brevoUsageCounter: {
      findFirst: jest.fn(async () => null),
    },
    $executeRaw: jest.fn(async () => 1),
  } as unknown as PrismaService;

  const usage = {
    recordSend: jest.fn(),
    recordSendBatch: jest.fn(),
  } as unknown as BrevoUsageService;

  const config = {
    get: jest.fn((k: string) => {
      if (k === 'BREVO_WEBHOOK_SECRET') return opts.secret ?? 'shh-secret';
      return undefined;
    }),
  } as unknown as ConfigService;

  const suppressions = {
    upsert: jest.fn(async () => ({ created: true })),
  } as unknown as BrevoSuppressionService;

  return {
    svc: new BrevoWebhookService(prisma, usage, config, suppressions),
    prisma,
    usage,
    config,
    suppressions,
  };
}

function signedBody(
  body: object,
  secret: string,
): {
  raw: string;
  signature: string;
} {
  const raw = JSON.stringify(body);
  const signature = createHmac('sha256', secret)
    .update(raw, 'utf8')
    .digest('hex');
  return { raw, signature };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BrevoWebhookService', () => {
  describe('verifySignature', () => {
    it('returns true when secret is unset (dev mode)', () => {
      const { svc } = buildService({ secret: '' });
      expect(svc.verifySignature('any', 'any')).toBe(true);
    });

    it('returns false when signature missing and secret set', () => {
      const { svc } = buildService({ secret: 'shh-secret' });
      expect(svc.verifySignature('any', undefined)).toBe(false);
    });

    it('returns false on signature mismatch', () => {
      const { svc } = buildService({ secret: 'shh-secret' });
      expect(svc.verifySignature('any', 'deadbeef')).toBe(false);
    });

    it('returns true on valid signature', () => {
      const { svc } = buildService({ secret: 'shh-secret' });
      const { raw, signature } = signedBody({ a: 1 }, 'shh-secret');
      expect(svc.verifySignature(raw, signature)).toBe(true);
    });

    it('uses constant-time comparison', () => {
      const { svc } = buildService({ secret: 'shh-secret' });
      const { raw, signature } = signedBody({ a: 1 }, 'shh-secret');
      // Wrong-length hex should not throw, return false
      expect(svc.verifySignature(raw, signature.slice(0, 8))).toBe(false);
    });
  });

  describe('handle', () => {
    it('throws Unauthorized on bad signature', async () => {
      const { svc } = buildService({ secret: 'shh-secret' });
      await expect(
        svc.handle(
          JSON.stringify({ event: 'delivered', email: 'a@b.c', id: 1 }),
          'bad',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequest on non-JSON body', async () => {
      const { svc } = buildService({ secret: '' });
      await expect(svc.handle('not-json', undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequest when email missing', async () => {
      const { svc } = buildService({ secret: '' });
      await expect(
        svc.handle(JSON.stringify({ event: 'delivered', id: 1 }), undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when id missing', async () => {
      const { svc } = buildService({ secret: '' });
      await expect(
        svc.handle(
          JSON.stringify({ event: 'delivered', email: 'a@b.c' }),
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns accepted=true for a known event', async () => {
      const { svc } = buildService({ secret: '' });
      const body = JSON.stringify({
        event: 'delivered',
        email: 'a@b.c',
        id: 12345,
        'message-id': '<m1@test>',
        date: '2026-01-01T00:00:00Z',
      });
      const r = await svc.handle(body, undefined);
      expect(r.accepted).toBe(true);
      expect(r.eventType).toBe('DELIVERED');
      expect(r.duplicate).toBeUndefined();
    });

    it('returns duplicate=true on P2002 unique constraint', async () => {
      const { svc } = buildService({
        secret: '',
        existingWebhookEvent: { id: 'old' },
      });
      const body = JSON.stringify({
        event: 'open',
        email: 'a@b.c',
        id: 99,
        'message-id': '<m1>',
      });
      const r = await svc.handle(body, undefined);
      expect(r.accepted).toBe(true);
      expect(r.duplicate).toBe(true);
      expect(r.eventType).toBe('OPEN');
    });

    it('returns accepted=false for unknown event', async () => {
      const { svc } = buildService({ secret: '' });
      const body = JSON.stringify({
        event: 'someFutureEvent',
        email: 'a@b.c',
        id: 7,
      });
      const r = await svc.handle(body, undefined);
      expect(r.accepted).toBe(false);
      expect(r.reason).toContain('someFutureEvent');
    });

    it('refunds the daily quota on BOUNCE_HARD', async () => {
      const { svc, prisma } = buildService({ secret: '' });
      const body = JSON.stringify({
        event: 'hardBounce',
        email: 'a@b.c',
        id: 5,
        'message-id': '<m1>',
        tag: 'tenantABC:agent1',
      });
      await svc.handle(body, undefined);
      expect(prisma.$executeRaw as jest.Mock).toHaveBeenCalled();
    });

    it('does NOT refund quota on BOUNCE_SOFT', async () => {
      const { svc, prisma } = buildService({ secret: '' });
      const body = JSON.stringify({
        event: 'softBounce',
        email: 'a@b.c',
        id: 5,
        'message-id': '<m1>',
        tag: 'tenantABC:agent1',
      });
      await svc.handle(body, undefined);
      expect(prisma.$executeRaw as jest.Mock).not.toHaveBeenCalled();
    });

    it('does NOT refund quota on BOUNCE_HARD when tenantId null', async () => {
      const { svc, prisma } = buildService({ secret: '' });
      const body = JSON.stringify({
        event: 'hardBounce',
        email: 'a@b.c',
        id: 5,
        'message-id': '<m1>',
        // no tag → tenantId null
      });
      await svc.handle(body, undefined);
      expect(prisma.$executeRaw as jest.Mock).not.toHaveBeenCalled();
    });

    it('adds to suppression list on BOUNCE_HARD', async () => {
      const { svc, suppressions } = buildService({ secret: '' });
      await svc.handle(
        JSON.stringify({
          event: 'hardBounce',
          email: 'a@b.c',
          id: 7,
          'message-id': '<m1>',
          tag: 'tenantABC:agent1',
          reason: 'mailbox full',
        }),
        undefined,
      );
      expect(suppressions.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'a@b.c',
          reason: 'BOUNCE_HARD',
          addedBy: 'system',
          tenantId: 'tenantABC',
        }),
      );
    });

    it('adds to suppression list on UNSUBSCRIBE', async () => {
      const { svc, suppressions } = buildService({ secret: '' });
      await svc.handle(
        JSON.stringify({
          event: 'unsubscribe',
          email: 'a@b.c',
          id: 8,
          'message-id': '<m1>',
          tag: 'tenantABC:agent1',
        }),
        undefined,
      );
      expect(suppressions.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'UNSUBSCRIBE' }),
      );
    });

    it('adds to suppression list on SPAM', async () => {
      const { svc, suppressions } = buildService({ secret: '' });
      await svc.handle(
        JSON.stringify({
          event: 'spam',
          email: 'a@b.c',
          id: 9,
          'message-id': '<m1>',
          tag: 'tenantABC:agent1',
        }),
        undefined,
      );
      expect(suppressions.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'SPAM_COMPLAINT' }),
      );
    });

    it('does NOT add to suppression list on DELIVERED/OPEN/CLICK', async () => {
      const { svc, suppressions } = buildService({ secret: '' });
      for (const event of ['delivered', 'open', 'click']) {
        await svc.handle(
          JSON.stringify({
            event,
            email: 'a@b.c',
            id: 10,
            'message-id': '<m1>',
            tag: 'tenantABC:agent1',
          }),
          undefined,
        );
      }
      expect(suppressions.upsert).not.toHaveBeenCalled();
    });
  });

  describe('listRecent', () => {
    it('queries prisma with tenantId, messageId, and clamped limit', async () => {
      const { svc, prisma } = buildService();
      (
        prisma.brevoWebhookEvent as unknown as { findMany: jest.Mock }
      ).findMany = jest.fn(async () => []);
      await svc.listRecent('tenant-1', { messageId: 'm1', limit: 1000 });
      const call = (
        prisma.brevoWebhookEvent as unknown as { findMany: jest.Mock }
      ).findMany.mock.calls[0][0];
      expect(call.where.tenantId).toBe('tenant-1');
      expect(call.where.messageId).toBe('m1');
      expect(call.take).toBe(500); // clamped to max
    });
  });
});
