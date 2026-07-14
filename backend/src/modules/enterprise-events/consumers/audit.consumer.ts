/**
 * Audit / Observability consumer (Phase 2 §11).
 *
 * Subscribes to ALL enterprise events and records a durable processing trace
 * (event, tenant, producer/source, consumer, correlation, causation, result,
 * retry count) using the existing ActivityEvent table via ActivityService —
 * no new observability infrastructure (Phase 2 §15). Idempotent per event.
 */

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Inject,
} from '@nestjs/common';
import { EVENT_TRANSPORT } from '../contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../contracts/enterprise-event-transport.interface';
import type { EnterpriseEvent } from '../contracts/enterprise-event.interface';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { Prisma } from '@prisma/client';

export const AUDIT_CONSUMER_ID = 'fabric-audit';

@Injectable()
export class AuditConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuditConsumer.name);

  constructor(
    @Inject(EVENT_TRANSPORT) private readonly transport: IEnterpriseEventTransport,
    private readonly idempotency: IdempotencyService,
    private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap(): void {
    this.transport.registerConsumer({
      consumerId: AUDIT_CONSUMER_ID,
      eventTypes: '*',
      handler: (event) => this.handle(event),
    });
  }

  private async handle(event: EnterpriseEvent): Promise<void> {
    await this.idempotency.runOnce(
      event.idempotencyKey,
      AUDIT_CONSUMER_ID,
      event.tenantId,
      async () => {
        // Persist a durable audit trace as an ActivityEvent row. sourceEventId
        // provides a second layer of dedup at the DB level.
        await this.prisma.activityEvent.create({
          data: {
            tenantId: event.tenantId,
            actorType: event.actorType === 'AI_AGENT' ? 'AI_AGENT' : 'SYSTEM',
            actorId: event.actorId ?? 'system',
            type: `fabric.trace.${event.eventType}`,
            title: `Event ${event.eventType} processed`,
            description: `producer=${event.sourceModule} consumer=${AUDIT_CONSUMER_ID} correlation=${event.correlationId} causation=${event.causationId ?? '-'}`,
            payload: {
              eventId: event.eventId,
              eventType: event.eventType,
              tenantId: event.tenantId,
              sourceModule: event.sourceModule,
              consumerId: AUDIT_CONSUMER_ID,
              correlationId: event.correlationId,
              causationId: event.causationId,
              result: 'PROCESSED',
            } as Prisma.InputJsonValue,
            severity: 'info',
            visibility: 'tenant',
            sourceEventId: `fabric:${event.eventId}:${AUDIT_CONSUMER_ID}`,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        });
      },
    );
  }
}
