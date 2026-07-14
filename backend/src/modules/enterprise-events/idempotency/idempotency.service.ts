/**
 * Business-effect idempotency (ADR-001 §6, ADR-012).
 *
 * Consumer inboxes prevent duplicate DELIVERY to the same consumer. This
 * ledger prevents duplicate BUSINESS EFFECTS if an event is ever delivered
 * more than once (transport recovery, replay, at-least-once). A consumer wraps
 * its side effect with `runOnce(idempotencyKey, consumerId, tenantId, fn)`.
 *
 * Tenant isolation: the unique key is (tenantId, idempotencyKey, consumerId),
 * so the same key under different tenants is two distinct ledger entries.
 * (Audit-remediation: the original P2 migration missed tenantId in the
 * unique; the 20260715_fix_idempotency_tenant_unique migration repaired it
 * and Prisma's @@unique was updated to match.)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * True if this (tenantId, idempotencyKey, consumerId) business effect already
   * applied. Cross-tenant ids with the same key are distinct ledger entries.
   */
  async alreadyApplied(
    tenantId: string,
    idempotencyKey: string,
    consumerId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.enterpriseEventIdempotency.findUnique({
      where: {
        tenantId_idempotencyKey_consumerId: { tenantId, idempotencyKey, consumerId },
      },
      select: { id: true },
    });
    return !!existing;
  }

  /**
   * Run `fn` at most once per (tenantId, idempotencyKey, consumerId). If
   * already applied, `fn` is skipped and `false` is returned. Records the
   * marker only AFTER `fn` succeeds, so a failure allows a genuine retry.
   */
  async runOnce(
    idempotencyKey: string,
    consumerId: string,
    tenantId: string,
    fn: () => Promise<void>,
  ): Promise<boolean> {
    if (await this.alreadyApplied(tenantId, idempotencyKey, consumerId)) {
      this.logger.debug(
        `Skipping duplicate business effect for ${tenantId}:${consumerId}:${idempotencyKey}`,
      );
      return false;
    }
    await fn();
    try {
      await this.prisma.enterpriseEventIdempotency.create({
        data: { idempotencyKey, consumerId, tenantId },
      });
    } catch (e: unknown) {
      // Concurrent duplicate — the effect ran once; the marker exists now.
      if ((e as { code?: string }).code !== 'P2002') throw e;
    }
    return true;
  }
}
