import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BrevoUsageService } from './brevo-usage.service';
import { BrevoSuppressionService } from './brevo-suppression.service';
import type { BrevoWebhookEventType } from '@prisma/client';

/**
 * Subset of Brevo's transactional webhook payload we care about.
 * Source: https://developers.brevo.com/docs/transactional-webhooks
 */
export interface BrevoWebhookPayload {
  event?: string; // delivered | open | click | hardBounce | softBounce | spam | unsubscribe | blocked | error | request
  email?: string; // recipient
  id?: number | string; // event id (unique per event)
  date?: string; // ISO timestamp from Brevo
  'message-id'?: string; // outbound messageId from Brevo's send endpoint
  reason?: string; // error reason for bounces / blocks
  tag?: string; // user-provided tag
  sender?: string; // sender email
  subject?: string;
  // Brevo may include a `templateId` or send-time metadata in some events.
  [k: string]: unknown;
}

/**
 * Map Brevo's `event` string → our DB enum.
 */
const EVENT_MAP: Record<string, BrevoWebhookEventType> = {
  delivered: 'DELIVERED',
  open: 'OPEN',
  click: 'CLICK',
  hardBounce: 'BOUNCE_HARD',
  softBounce: 'BOUNCE_SOFT',
  spam: 'SPAM',
  unsubscribe: 'UNSUBSCRIBE',
  blocked: 'BLOCKED',
  error: 'ERROR',
  request: 'REQUEST',
};

@Injectable()
export class BrevoWebhookService {
  private readonly logger = new Logger(BrevoWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: BrevoUsageService,
    private readonly config: ConfigService,
    private readonly suppressions: BrevoSuppressionService,
  ) {}

  private get secret(): string {
    return (
      this.config.get<string>('BREVO_WEBHOOK_SECRET') ||
      this.config.get<string>('BREVO_WEBHOOK_SIGNING_SECRET') ||
      ''
    );
  }

  /** Whether signature verification is enabled. */
  get signatureVerificationEnabled(): boolean {
    return this.secret.length > 0;
  }

  /**
   * Verify Brevo's HMAC-SHA256 webhook signature.
   *
   * Brevo sends the signature in the `X-Brevo-Signature` header
   * (also accepted: `signature` query, `X-Webhook-Signature`). When
   * `BREVO_WEBHOOK_SECRET` is unset, verification is disabled (dev only).
   */
  verifySignature(rawBody: string, signature: string | undefined): boolean {
    if (!this.signatureVerificationEnabled) {
      this.logger.warn(
        'BREVO_WEBHOOK_SECRET is not set — webhook signature verification is DISABLED.',
      );
      return true;
    }
    if (!signature) return false;
    const expected = createHmac('sha256', this.secret)
      .update(rawBody, 'utf8')
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Normalize and persist a Brevo webhook payload.
   *
   * Idempotent: (externalId, eventType) is unique. Re-deliveries are
   * silently swallowed to avoid inflating usage counters on retries.
   */
  async handle(
    rawBody: string,
    signature?: string,
  ): Promise<{
    accepted: boolean;
    duplicate?: boolean;
    eventType?: BrevoWebhookEventType;
    reason?: string;
  }> {
    if (!this.verifySignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Brevo webhook signature');
    }

    let payload: BrevoWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as BrevoWebhookPayload;
    } catch (err) {
      throw new BadRequestException(
        `Webhook body is not valid JSON: ${(err as Error).message}`,
      );
    }

    const eventName = (payload.event ?? '').toString();
    const eventType = EVENT_MAP[eventName];
    if (!eventType) {
      this.logger.warn(`Unknown Brevo event: ${eventName}`);
      return { accepted: false, reason: `unknown event: ${eventName}` };
    }
    if (!payload.email) {
      throw new BadRequestException('Webhook missing `email` field');
    }
    if (!payload.id) {
      throw new BadRequestException('Webhook missing `id` field');
    }

    const occurredAt = payload.date ? new Date(payload.date) : new Date();

    const tenantId = await this.resolveTenantId(payload);

    try {
      await this.prisma.brevoWebhookEvent.create({
        data: {
          tenantId,
          externalId: String(payload.id),
          eventType,
          email: payload.email,
          messageId: payload['message-id'] ?? null,
          payload: payload as object,
          occurredAt,
        },
      });
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === 'P2002') {
        // Unique constraint hit → Brevo redelivered
        return { accepted: true, duplicate: true, eventType };
      }
      throw err;
    }

    // On hard bounce, the address is dead and the send didn't really
    // cost us delivery capacity. Refund the day's quota by 1.
    if (eventType === 'BOUNCE_HARD' && tenantId) {
      await this.refundQuota(tenantId);
    }

    // For hard bounces, unsubscribes, and spam complaints we add the
    // recipient to the suppression list so future sends skip them.
    if (
      eventType === 'BOUNCE_HARD' ||
      eventType === 'UNSUBSCRIBE' ||
      eventType === 'SPAM'
    ) {
      const reason =
        eventType === 'BOUNCE_HARD'
          ? 'BOUNCE_HARD'
          : eventType === 'UNSUBSCRIBE'
            ? 'UNSUBSCRIBE'
            : 'SPAM_COMPLAINT';
      await this.suppressions
        .upsert({
          tenantId,
          email: payload.email,
          reason,
          addedBy: 'system',
          details: {
            eventId: payload.id,
            messageId: payload['message-id'] ?? null,
            reason: payload.reason ?? null,
            occurredAt: payload.date ?? null,
          },
        })
        .catch((err: unknown) => {
          this.logger.warn(
            `Suppression upsert failed: ${(err as Error).message}`,
          );
        });
    }

    this.logger.log(
      `Webhook ${eventType} from=${payload.email} messageId=${payload['message-id'] ?? '-'} tenant=${tenantId ?? '-'}`,
    );
    return { accepted: true, eventType };
  }

  /**
   * Brevo's webhooks don't always carry tenant context. We recover it by:
   *   1. Custom `tag` if it matches `<tenantId>:...`
   *   2. Looking up the messageId against an in-memory / out-of-band map
   *      (best-effort; resolution may be null).
   */
  private async resolveTenantId(
    payload: BrevoWebhookPayload,
  ): Promise<string | null> {
    if (typeof payload.tag === 'string') {
      const [maybeTenant] = payload.tag.split(':');
      if (maybeTenant && maybeTenant.length > 8) return maybeTenant;
    }
    const messageId = payload['message-id'];
    if (typeof messageId === 'string' && messageId.length > 0) {
      const row = await this.prisma.brevoUsageCounter
        .findFirst({
          where: { tenantId: { contains: messageId } },
          select: { tenantId: true },
        })
        .catch(() => null);
      // The above is a weak heuristic — real mapping would use a separate
      // `outbound_messages` table. Returning whatever we can find is best-
      // effort for analytics; the controller may still return records
      // tagged with `tenantId: null`.
      if (row?.tenantId) return row.tenantId;
    }
    return null;
  }

  /**
   * Best-effort quota refund for hard-bounce events.
   *
   * Decrements today's `BrevoUsageCounter` row by 1, floored at 0.
   * A failure here is logged but does NOT block the webhook (we already
   * accepted the delivery report).
   */
  private async refundQuota(tenantId: string): Promise<void> {
    const today = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
      ),
    );
    try {
      await this.prisma.$executeRaw`
        UPDATE "brevo_usage_counters"
        SET "sentCount" = GREATEST(0, "sentCount" - 1)
        WHERE "tenantId" = ${tenantId} AND "date" = ${today}::date
      `;
    } catch (err) {
      this.logger.warn(
        `Quota refund failed for tenant ${tenantId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Read recent delivery events for a tenant — surfaced via the
   * `GET /integrations/brevo/events` controller endpoint.
   */
  async listRecent(
    tenantId: string,
    opts: { messageId?: string; limit?: number } = {},
  ) {
    return this.prisma.brevoWebhookEvent.findMany({
      where: {
        tenantId,
        ...(opts.messageId ? { messageId: opts.messageId } : {}),
      },
      orderBy: { receivedAt: 'desc' },
      take: Math.min(Math.max(opts.limit ?? 50, 1), 500),
    });
  }
}
