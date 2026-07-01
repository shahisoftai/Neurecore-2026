import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { IBillingEventEmitter } from '../interfaces/finance.interfaces';
import { BillingEventType } from '@prisma/client';

/**
 * BillingEventsService — Phase 4.4
 *
 * SRP:  Records billing domain events to the database.
 *       In production, extend to also publish to a message queue (Bull/Kafka).
 * OCP:  Add queue publishing in a subclass or decorator without changing this service.
 */
@Injectable()
export class BillingEventsService implements IBillingEventEmitter {
  private readonly logger = new Logger(BillingEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async emit(
    tenantId: string,
    type: string,
    payload: Record<string, unknown>,
    invoiceId?: string,
  ): Promise<void> {
    await this.prisma.billingEvent.create({
      data: {
        tenantId,
        type: type as BillingEventType,
        payload: payload as never,
        invoiceId: invoiceId ?? null,
        processedAt: new Date(),
      },
    });
    this.logger.debug(`BillingEvent emitted: ${type} for tenant ${tenantId}`);
  }

  async findAll(tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const data = await this.prisma.billingEvent.findMany({
      where: { tenantId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    const total = await this.prisma.billingEvent.count({ where: { tenantId } });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
