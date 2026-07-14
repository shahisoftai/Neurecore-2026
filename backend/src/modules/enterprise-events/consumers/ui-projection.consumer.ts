/**
 * UI Projection consumer (Phase 2 §11, ADR-001 §F).
 *
 * Projects approved enterprise events to the correct tenant Socket.IO room.
 * Socket.IO is a NON-DURABLE presentation projection derived from the durable
 * fabric — it is never the transport. If Socket.IO is down, durable processing
 * is unaffected (this handler swallows emit errors so the inbox row still
 * settles PROCESSED). Tenant-scoped: only emits to `tenant:<event.tenantId>`.
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
import { EventsGateway } from '../../events/events.gateway';

export const UI_PROJECTION_CONSUMER_ID = 'fabric-ui-projection';

@Injectable()
export class UiProjectionConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(UiProjectionConsumer.name);

  constructor(
    @Inject(EVENT_TRANSPORT) private readonly transport: IEnterpriseEventTransport,
    private readonly gateway: EventsGateway,
  ) {}

  onApplicationBootstrap(): void {
    this.transport.registerConsumer({
      consumerId: UI_PROJECTION_CONSUMER_ID,
      eventTypes: '*',
      handler: (event) => this.handle(event),
    });
  }

  private handle(event: EnterpriseEvent): void {
    try {
      // Presentation projection only — routes strictly to the event's tenant.
      this.gateway.emitToTenant(event.tenantId, 'enterprise:event', {
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
        payload: event.payload,
        timestamp: event.timestamp,
      });
    } catch (err) {
      // Socket.IO failure must NOT affect durable processing (ADR-001 §F).
      this.logger.warn(
        `UI projection emit failed for ${event.eventId} (durable processing unaffected): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
